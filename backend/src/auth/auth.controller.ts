import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
} from "@nestjs/common";
import { AuthService, TelegramWidgetData } from "./auth.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/telegram
   *
   * Receives raw Telegram Login Widget data from the frontend
   * (id, first_name, last_name, username, photo_url, auth_date, hash).
   * All verification is done here on the backend — frontend is just a forwarder.
   */
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(ThrottlerGuard)
  @Post("telegram")
  login(@Body() data: TelegramWidgetData) {
    return this.authService.loginFromWidget(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.sub);
  }
}