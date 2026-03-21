import { Injectable, Logger } from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";

type LocaleMap = Record<string, any>;

@Injectable()
export class BotI18nService {
  private readonly logger = new Logger(BotI18nService.name);
  private readonly locales: Record<string, LocaleMap> = {};
  private readonly defaultLocale = "ru";

  constructor() {
    this.loadLocales();
  }

  private loadLocales() {
    const dir = path.join(__dirname, "i18n", "locales");
    if (!fs.existsSync(dir)) {
      this.logger.warn(`Locales directory not found: ${dir}`);
      return;
    }

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const locale = file.replace(".json", "");
      try {
        this.locales[locale] = JSON.parse(
          fs.readFileSync(path.join(dir, file), "utf-8")
        );
        this.logger.debug(`Loaded locale: ${locale}`);
      } catch (e) {
        this.logger.error(`Failed to load locale ${locale}: ${e.message}`);
      }
    }
  }

  /** Resolves a dot-separated key with optional {{var}} interpolation. */
  t(
    locale: string,
    key: string,
    vars?: Record<string, string | number>
  ): string {
    const messages =
      this.locales[locale] ?? this.locales[this.defaultLocale] ?? {};
    const value = key
      .split(".")
      .reduce((obj: any, seg) => obj?.[seg], messages);

    if (typeof value !== "string") {
      this.logger.warn(`Missing translation: [${locale}] ${key}`);
      return key;
    }

    if (!vars) return value;

    return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
    );
  }

  getSupportedLocales(): string[] {
    return Object.keys(this.locales);
  }
}
