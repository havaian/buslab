import { Controller, Post, Body, Get, Patch, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

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

  /** Saves UI preferences (theme) for any authenticated user — panel & miniapp. */
  @UseGuards(JwtAuthGuard)
  @Patch("preferences")
  setPreferences(
    @CurrentUser() user: any,
    @Body("theme") theme: "light" | "dark"
  ) {
    return this.authService.setPreferences(user.sub, theme);
  }
}