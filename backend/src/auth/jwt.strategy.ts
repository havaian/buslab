import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Нельзя запускать без секрета — любой мог бы подписать валидный токен
      throw new Error(
        "JWT_SECRET environment variable is not set. Refusing to start."
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    if (!payload.sub) throw new UnauthorizedException();

    // Проверяем isBanned при каждом запросе — заблокированный не должен работать
    // до истечения JWT (7 дней).
    // Запрос к БД на каждый authenticated request — осознанный trade-off
    // между безопасностью и производительностью для данного масштаба.
    const user = await this.userModel
      .findById(payload.sub)
      .select("isBanned")
      .lean();

    if (!user) throw new UnauthorizedException();
    if (user.isBanned) throw new ForbiddenException("User is blocked");

    return {
      sub: payload.sub,
      telegramId: payload.telegramId,
      role: payload.role,
    };
  }
}
