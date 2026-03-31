import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Bot } from "grammy";
import { BotContext } from "./context.type";
import { BotUpdate } from "./bot.update";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./bot.constants";
import { User, UserDocument } from "../users/schemas/user.schema";

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: Bot<BotContext> | undefined;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly botUpdate: BotUpdate
  ) {}

  onModuleInit(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN not set - bot will not start");
      return;
    }

    this.bot = new Bot<BotContext>(token);
    this.registerMiddleware(this.bot);
    this.botUpdate.register(this.bot);

    this.bot.catch((err) => {
      this.logger.error("Bot handler error:", err);
    });

    this.bot
      .start({
        onStart: (info) =>
          this.logger.log(`Bot @${info.username} started (long polling)`),
      })
      .catch((err) => this.logger.error("Bot polling error:", err));
  }

  onModuleDestroy(): void {
    this.bot?.stop();
  }

  // ── Middleware ──────────────────────────────────────────────────────────

  private registerMiddleware(bot: Bot<BotContext>): void {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const studentChatId = process.env.TELEGRAM_STUDENT_CHAT_ID;

    bot.use(async (ctx, next) => {
      const chatId = ctx.chat?.id?.toString();

      // Force Russian in group chats - no DB lookup needed
      if (chatId === adminChatId || chatId === studentChatId) {
        ctx.locale = DEFAULT_LOCALE;
        return next();
      }

      if (!ctx.from) {
        ctx.locale = DEFAULT_LOCALE;
        return next();
      }

      const user = await this.userModel
        .findOne({ telegramId: ctx.from.id })
        .select("language isBanned")
        .lean();

      // Ban check for private chats
      if (user?.isBanned && ctx.chat?.type === "private") {
        await ctx.reply(
          "🚫 Вы заблокированы и не можете использовать этого бота."
        );
        return;
      }

      // Resolve locale: DB → Telegram language_code → default
      if (user?.language && SUPPORTED_LOCALES.includes(user.language as any)) {
        ctx.locale = user.language;
      } else {
        const tgCode = ctx.from.language_code?.split("-")[0] ?? "";
        const localeMap: Record<string, string> = {
          ru: "ru",
          uz: "uz",
          en: "en",
        };
        ctx.locale = localeMap[tgCode] ?? DEFAULT_LOCALE;
      }

      return next();
    });
  }
}
