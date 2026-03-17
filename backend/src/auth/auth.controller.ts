import { Controller, Post, Body, Get, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { TelegramAuthDto } from "./dto/telegram-auth.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // На метод login добавить:
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(ThrottlerGuard)
  @Post("telegram")
  login(@Body() dto: TelegramAuthDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.sub);
  }
}
