import { Controller, Get, Put, Param, Body, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";

@Controller("api/settings")
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(":key")
  get(@Param("key") key: string) {
    return this.settingsService.get(key);
  }

  @Put(":key")
  set(@Param("key") key: string, @Body("value") value: Record<string, string>) {
    return this.settingsService.set(key, value);
  }
}
