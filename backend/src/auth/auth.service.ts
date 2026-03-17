import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as crypto from "crypto";
import {
  AdminUser,
  AdminUserDocument,
} from "../admin-users/schemas/admin-user.schema";
import { TelegramAuthDto } from "./dto/telegram-auth.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(AdminUser.name)
    private adminUserModel: Model<AdminUserDocument>,
    private jwtService: JwtService
  ) {}

  // Verifies Telegram Login Widget data hash
  verifyTelegramHash(data: TelegramAuthDto): boolean {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    console.log(
      "BOT TOKEN:",
      botToken ? `${botToken.slice(0, 10)}...` : "UNDEFINED"
    );

    const secret = crypto.createHash("sha256").update(botToken).digest();

    const { hash, ...rest } = data;
    const checkString = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join("\n");

    console.log("CHECK STRING:", checkString);
    console.log("EXPECTED HASH:", hash);

    const computedHash = crypto
      .createHmac("sha256", secret)
      .update(checkString)
      .digest("hex");

    console.log("COMPUTED HASH:", computedHash);
    console.log("MATCH:", computedHash === hash);

    return computedHash === hash;
  }

  async login(dto: TelegramAuthDto) {
    if (!this.verifyTelegramHash(dto)) {
      throw new UnauthorizedException("Invalid Telegram auth data");
    }

    // auth_date must not be older than 24 hours
    const now = Math.floor(Date.now() / 1000);
    if (now - dto.auth_date > 86400) {
      throw new UnauthorizedException("Telegram auth data is expired");
    }

    const user = await this.adminUserModel.findOne({
      telegramId: String(dto.id),
    });

    if (!user) {
      throw new UnauthorizedException("User not registered in the system");
    }

    if (user.isBlocked) {
      throw new ForbiddenException("User is blocked");
    }

    // Update profile data from Telegram
    user.firstName = dto.first_name;
    user.lastName = dto.last_name || "";
    user.username = dto.username || "";
    user.photoUrl = dto.photo_url || "";
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
        photoUrl: user.photoUrl,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.adminUserModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException("User not found");
    if (user.isBlocked) throw new ForbiddenException("User is blocked");
    return {
      id: String(user._id),
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
      photoUrl: user.photoUrl,
    };
  }
}
