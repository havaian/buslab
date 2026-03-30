import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { User, UserDocument } from "../users/schemas/user.schema";

// Correct JWKS endpoint per https://core.telegram.org/bots/telegram-login
const TELEGRAM_JWKS = createRemoteJWKSet(
  new URL("https://oauth.telegram.org/.well-known/jwks.json")
);

interface TelegramIdTokenClaims {
  sub: string;
  id: number;
  name?: string;
  preferred_username?: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService
  ) {}

  private async verifyTelegramIdToken(
    idToken: string
  ): Promise<TelegramIdTokenClaims> {
    const clientId = process.env.TELEGRAM_BOT_CLIENT_ID;
    if (!clientId) throw new Error("TELEGRAM_BOT_CLIENT_ID not set");

    const { payload } = await jwtVerify(idToken, TELEGRAM_JWKS, {
      issuer: "https://oauth.telegram.org",
      audience: clientId,
    });

    return payload as unknown as TelegramIdTokenClaims;
  }

  async login(idToken: string) {
    let claims: TelegramIdTokenClaims;

    try {
      claims = await this.verifyTelegramIdToken(idToken);
    } catch (err) {
      console.error("[Auth] JWKS verification failed:", err);
      throw new UnauthorizedException("Invalid Telegram auth token");
    }

    if (!claims.id) {
      throw new UnauthorizedException("Invalid token: missing user id");
    }

    const user = await this.userModel.findOne({
      telegramId: claims.id,
      role: { $in: ["admin", "student"] },
    });

    if (!user) {
      throw new UnauthorizedException("User not registered in the system");
    }

    if (user.isBanned) {
      throw new ForbiddenException("User is blocked");
    }

    if (claims.name) {
      const [firstName, ...rest] = claims.name.split(" ");
      user.firstName = firstName;
      user.lastName = rest.join(" ") || "";
    }
    if (claims.preferred_username) {
      user.username = claims.preferred_username;
    }

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
