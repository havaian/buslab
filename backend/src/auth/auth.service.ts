import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import { User, UserDocument } from "../users/schemas/user.schema";

// ── Telegram Login Widget hash verification ───────────────────────────────
//
// Spec: https://core.telegram.org/widgets/login#checking-authorization
//
// 1. Take all fields from callback data except "hash"
// 2. Sort alphabetically, join as "key=value\n"
// 3. secret_key = SHA256(bot_token)   ← raw digest, NOT hmac
// 4. expected   = HEX(HMAC-SHA256(secret_key, data_check_string))
// 5. Compare expected with hash
//
// NOTE: intentionally different from Mini App verification which uses
// HMAC-SHA256("WebAppData", bot_token) as secret key.

export interface TelegramWidgetUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService
  ) {}

  // ── Private ───────────────────────────────────────────────────────────────

  private verifyWidgetHash(data: TelegramWidgetUser): boolean {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not set");

    const { hash, ...rest } = data;
    if (!hash) return false;

    const checkEntries = Object.entries(rest)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    const dataCheckString = checkEntries.join("\n");

    // secret_key = SHA256(bot_token) — raw bytes
    const secretKey = crypto.createHash("sha256").update(botToken).digest();

    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return expectedHash === hash;
  }

  // ── Public ────────────────────────────────────────────────────────────────

  async login(data: TelegramWidgetUser) {
    if (!this.verifyWidgetHash(data)) {
      throw new UnauthorizedException("Invalid Telegram auth signature");
    }

    // auth_date freshness check — max 1 hour
    const authDate = Number(data.auth_date);
    if (!authDate || Date.now() / 1000 - authDate > 3600) {
      throw new UnauthorizedException("Auth data expired");
    }

    const telegramId = Number(data.id);
    if (!telegramId) {
      throw new UnauthorizedException("Invalid Telegram ID");
    }

    const user = await this.userModel.findOne({
      telegramId,
      role: { $in: ["admin", "student"] },
    });

    if (!user) {
      throw new UnauthorizedException("User not registered in the system");
    }

    if (user.isBanned) {
      throw new ForbiddenException("User is blocked");
    }

    // Update profile from widget data
    if (data.first_name) user.firstName = data.first_name;
    if (data.last_name !== undefined) user.lastName = data.last_name ?? "";
    if (data.username) user.username = data.username;

    // Track panel usage
    user.lastSeenSource = "panel";
    user.hasUsedPanel = true;

    await user.save();

    const payload = {
      sub: String(user._id),
      telegramId: user.telegramId,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: String(user._id),
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException("User not found");
    if (user.isBanned) throw new ForbiddenException("User is blocked");
    return {
      id: String(user._id),
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
    };
  }
}
