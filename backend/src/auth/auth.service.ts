import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as crypto from "crypto";
import { User, UserDocument } from "../users/schemas/user.schema";
import { TelegramAuthDto } from "./dto/telegram-auth.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService
  ) {}

  verifyTelegramHash(data: TelegramAuthDto): boolean {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const secret = crypto.createHash("sha256").update(botToken).digest();

    const { hash, ...rest } = data;
    const checkString = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join("\n");

    const computedHash = crypto
      .createHmac("sha256", secret)
      .update(checkString)
      .digest("hex");

    return computedHash === hash;
  }

  async login(dto: TelegramAuthDto) {
    if (!this.verifyTelegramHash(dto)) {
      throw new UnauthorizedException("Invalid Telegram auth data");
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - dto.auth_date > 86400) {
      throw new UnauthorizedException("Telegram auth data is expired");
    }

    const user = await this.userModel.findOne({
      telegramId: Number(dto.id),
      role: { $in: ["admin", "student"] },
    });

    if (!user) {
      throw new UnauthorizedException("User not registered in the system");
    }

    if (user.isBanned) {
      throw new ForbiddenException("User is blocked");
    }

    // Update profile from Telegram
    user.firstName = dto.first_name;
    user.lastName = dto.last_name || "";
    user.username = dto.username || "";
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
