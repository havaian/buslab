import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
  Get,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import * as crypto from "crypto";
import { User, UserDocument } from "../users/schemas/user.schema";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";

const ALLOWED_LANGUAGES = ["ru", "uz", "en", "kk"];

@Controller("miniapp")
export class MiniappController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Verifies Telegram WebApp initData via HMAC-SHA256.
   * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   *
   * Fix #7: добавлен rate limit — 20 запросов в минуту на IP
   */
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseGuards(ThrottlerGuard)
  @Post("auth")
  async auth(@Body("initData") initData: string) {
    if (!initData) throw new UnauthorizedException("initData is required");

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new UnauthorizedException("Bot token not configured");

    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) throw new UnauthorizedException("Missing hash in initData");

    const checkEntries: string[] = [];
    params.forEach((value, key) => {
      if (key !== "hash") checkEntries.push(`${key}=${value}`);
    });
    checkEntries.sort();
    const dataCheckString = checkEntries.join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (expectedHash !== hash) {
      throw new UnauthorizedException("Invalid initData signature");
    }

    const authDate = Number(params.get("auth_date"));
    if (!authDate || Date.now() / 1000 - authDate > 3600) {
      throw new UnauthorizedException("initData expired");
    }

    const userJson = params.get("user");
    if (!userJson) throw new UnauthorizedException("No user in initData");

    let tgUser: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    try {
      tgUser = JSON.parse(userJson);
    } catch {
      throw new UnauthorizedException("Invalid user JSON in initData");
    }

    let user = await this.userModel.findOne({ telegramId: tgUser.id });
    if (!user) {
      const rawLang = tgUser.language_code?.split("-")[0] ?? "ru";
      user = await this.userModel.create({
        telegramId: tgUser.id,
        firstName: tgUser.first_name ?? "",
        lastName: tgUser.last_name ?? "",
        username: tgUser.username ?? "",
        language: ALLOWED_LANGUAGES.includes(rawLang) ? rawLang : "ru",
        lastSeenSource: "miniapp",
        hasUsedMiniapp: true,
      });
    } else {
      user.firstName = tgUser.first_name ?? user.firstName;
      user.lastName = tgUser.last_name ?? user.lastName ?? "";
      user.username = tgUser.username ?? user.username ?? "";
      user.lastSeenSource = "miniapp";
      user.hasUsedMiniapp = true;
      await user.save();
    }

    if (user.isBanned) {
      throw new UnauthorizedException("User is banned");
    }

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
        theme: (user as any).theme ?? "light",
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMe(@CurrentUser() user: any) {
    return this.userModel
      .findById(user.sub)
      .select("-__v")
      .lean()
      .then((u) => {
        if (!u) throw new UnauthorizedException();
        return {
          id: String(u._id),
          telegramId: u.telegramId,
          firstName: u.firstName,
          lastName: u.lastName,
          username: u.username,
          role: u.role,
          university: u.university ?? null,
          faculty: u.faculty ?? null,
          course: u.course ?? null,
          theme: (u as any).theme ?? "light",
        };
      });
  }

  /**
   * Fix #6: валидируем university/faculty как непустые строки если заданы,
   * course — целое число в диапазоне 1–6.
   */
  @UseGuards(JwtAuthGuard)
  @Patch("profile")
  async updateProfile(
    @CurrentUser() user: any,
    @Body("university") university?: string | null,
    @Body("faculty") faculty?: string | null,
    @Body("course") course?: number | null
  ) {
    const update: Record<string, any> = {};

    if (university !== undefined) {
      if (
        university !== null &&
        (typeof university !== "string" || !university.trim())
      ) {
        throw new BadRequestException(
          "university must be a non-empty string or null"
        );
      }
      update.university = university || null;
    }

    if (faculty !== undefined) {
      if (
        faculty !== null &&
        (typeof faculty !== "string" || !faculty.trim())
      ) {
        throw new BadRequestException(
          "faculty must be a non-empty string or null"
        );
      }
      update.faculty = faculty || null;
    }

    if (course !== undefined) {
      if (course !== null) {
        const n = Number(course);
        if (!Number.isInteger(n) || n < 1 || n > 6) {
          throw new BadRequestException(
            "course must be an integer between 1 and 6"
          );
        }
        update.course = n;
      } else {
        update.course = null;
      }
    }

    await this.userModel.updateOne({ _id: user.sub }, { $set: update });
    return { ok: true };
  }
}
