import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Get,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import { User, UserDocument } from "../users/schemas/user.schema";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";

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
   * Flow:
   * 1. Parse initData query string
   * 2. Extract hash, sort remaining fields, build data_check_string
   * 3. secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
   * 4. Compare HMAC-SHA256(secret_key, data_check_string) with hash
   * 5. Check auth_date is not older than 1 hour
   * 6. Upsert user, return JWT
   */
  @Post("auth")
  async auth(@Body("initData") initData: string) {
    if (!initData) throw new UnauthorizedException("initData is required");

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new UnauthorizedException("Bot token not configured");

    // Parse the initData query string
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) throw new UnauthorizedException("Missing hash in initData");

    // Build data_check_string: all fields except hash, sorted alphabetically, joined by \n
    const checkEntries: string[] = [];
    params.forEach((value, key) => {
      if (key !== "hash") checkEntries.push(`${key}=${value}`);
    });
    checkEntries.sort();
    const dataCheckString = checkEntries.join("\n");

    // Compute secret key: HMAC-SHA256(key="WebAppData", data=botToken)
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // Compute expected hash
    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (expectedHash !== hash) {
      throw new UnauthorizedException("Invalid initData signature");
    }

    // Check auth_date freshness (1 hour max)
    const authDate = Number(params.get("auth_date"));
    if (!authDate || Date.now() / 1000 - authDate > 3600) {
      throw new UnauthorizedException("initData expired");
    }

    // Parse user object from initData
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

    // Upsert user in DB
    let user = await this.userModel.findOne({ telegramId: tgUser.id });
    if (!user) {
      user = await this.userModel.create({
        telegramId: tgUser.id,
        firstName: tgUser.first_name ?? "",
        lastName: tgUser.last_name ?? "",
        username: tgUser.username ?? "",
        language: tgUser.language_code?.split("-")[0] ?? "ru",
        lastSeenSource: "miniapp",
        hasUsedMiniapp: true,
      });
    } else {
      // Refresh profile fields
      user.firstName = tgUser.first_name ?? user.firstName;
      user.lastName = tgUser.last_name ?? user.lastName ?? "";
      user.username = tgUser.username ?? user.username ?? "";

      // Track miniapp usage
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
      },
    };
  }

  /** Returns current user info - same as /auth/me but usable from miniapp context. */
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
        };
      });
  }

  @UseGuards(JwtAuthGuard)
  @Patch("profile")
  async updateProfile(
    @CurrentUser() user: any,
    @Body("university") university?: string,
    @Body("faculty") faculty?: string,
    @Body("course") course?: number
  ) {
    const update: Record<string, any> = {};
    if (university !== undefined) update.university = university;
    if (faculty !== undefined) update.faculty = faculty;
    if (course !== undefined) update.course = course;

    await this.userModel.updateOne({ _id: user.sub }, { $set: update });
    return { ok: true };
  }
}
