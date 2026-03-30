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
// 1. Take all query params except "hash", sort alphabetically, join as "key=value\n"
// 2. secret_key = SHA256(bot_token)   ← raw digest, NOT hmac
// 3. expected   = HEX(HMAC-SHA256(secret_key, data_check_string))
// 4. Compare expected with hash

export interface TelegramWidgetData {
  id: string | number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string | number;
  hash: string;
  [key: string]: unknown;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService
  ) {}

  // ── Private ───────────────────────────────────────────────────────────────

  private verifyWidgetHash(data: TelegramWidgetData): boolean {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not set");

    const { hash, ...rest } = data;
    if (!hash) return false;

    // Build data_check_string: sorted "key=value" pairs joined by \n
    const checkEntries = Object.entries(rest)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    const dataCheckString = checkEntries.join("\n");

    // secret_key = SHA256(bot_token) — raw bytes, not HMAC
    const secretKey = crypto.createHash("sha256").update(botToken).digest();

    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return expectedHash === hash;
  }

  // ── Public ────────────────────────────────────────────────────────────────

  /** Called from the redirect callback — verifies hash, returns JWT + user */
  async loginFromWidget(data: TelegramWidgetData) {
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
    if (data.first_name) user.firstName = String(data.first_name);
    if (data.last_name !== undefined)
      user.lastName = String(data.last_name ?? "");
    if (data.username) user.username = String(data.username);

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
