import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

const ALLOWED_THEMES = ["light", "dark"] as const;

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(ThrottlerGuard)
  @Post("telegram")
  login(@Body("id_token") idToken: string) {
    return this.authService.login(idToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.sub);
  }

  /** Fix #5: валидируем что theme — строго "light" или "dark" */
  @UseGuards(JwtAuthGuard)
  @Patch("preferences")
  setPreferences(@CurrentUser() user: any, @Body("theme") theme: string) {
    if (!ALLOWED_THEMES.includes(theme as any)) {
      throw new BadRequestException(
        `theme must be one of: ${ALLOWED_THEMES.join(", ")}`
      );
    }
    return this.authService.setPreferences(user.sub, theme as "light" | "dark");
  }
}
