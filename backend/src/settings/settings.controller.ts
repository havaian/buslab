import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import * as path from "path";
import * as fs from "fs";
import { SettingsService } from "./settings.service";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";

const ALLOWED_LOCALES = ["ru", "uz", "en"] as const;
type AllowedLocale = (typeof ALLOWED_LOCALES)[number];

// Path to locale files — works for both src (ts-node) and dist (compiled)
// __dirname = .../settings/, locales are at ../bot/i18n/locales/
const LOCALES_DIR = path.join(__dirname, "..", "bot", "i18n", "locales");

@Controller("settings")
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class SettingsController implements OnModuleInit {
  // Resolved lazily after app is fully initialized to avoid circular deps
  private botI18nService: { reload: () => void } | null = null;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly moduleRef: ModuleRef
  ) {}

  onModuleInit() {
    // Dynamically look up BotI18nService without importing BotModule
    // (which would create a circular dependency chain)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { BotI18nService } = require("../bot/bot-i18n.service");
      this.botI18nService = this.moduleRef.get(BotI18nService, {
        strict: false,
      });
    } catch {
      // BotI18nService not available — locale hot-reload will be skipped
    }
  }

  // ── Rejection text settings ───────────────────────────────────────────────

  @Get(":key")
  get(@Param("key") key: string) {
    return this.settingsService.get(key);
  }

  @Put(":key")
  set(@Param("key") key: string, @Body("value") value: Record<string, string>) {
    return this.settingsService.set(key, value);
  }

  // ── Bot locale file management ────────────────────────────────────────────

  @Get("locales/:locale")
  getLocale(@Param("locale") locale: string): Record<string, any> {
    if (!ALLOWED_LOCALES.includes(locale as AllowedLocale)) {
      throw new NotFoundException(`Locale "${locale}" not found`);
    }
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Locale file "${locale}.json" not found`);
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      throw new BadRequestException(
        `Failed to read locale file "${locale}.json"`
      );
    }
  }

  @Put("locales/:locale")
  saveLocale(
    @Param("locale") locale: string,
    @Body("content") content: Record<string, any>
  ): { ok: boolean } {
    if (!ALLOWED_LOCALES.includes(locale as AllowedLocale)) {
      throw new NotFoundException(`Locale "${locale}" not found`);
    }
    if (!content || typeof content !== "object") {
      throw new BadRequestException("content must be an object");
    }

    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), "utf-8");
    } catch (e) {
      throw new BadRequestException(
        `Failed to write locale file: ${(e as Error).message}`
      );
    }

    // Hot-reload the in-memory locale map
    this.botI18nService?.reload();

    return { ok: true };
  }
}
