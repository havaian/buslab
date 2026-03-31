import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { BotContext } from "./context.type";
import { UserState, AdminState } from "./states.type";
import { CB, CBRegex } from "./bot.constants";
import { BotI18nService } from "./bot-i18n.service";
import { SubmitRequestConversation } from "./conversations/submit-request.conversation";
import { RequestsService } from "../requests/requests.service";
import { AdminUsersService } from "../admin-users/admin-users.service";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Faq, FaqDocument } from "../faq/schemas/faq.schema";
import { Request, RequestDocument } from "../requests/schemas/request.schema";
import {
  University,
  UniversityDocument,
} from "../universities/schemas/university.schema";
import {
  Faculty,
  FacultyDocument,
} from "../universities/schemas/faculty.schema";
import mongoose from "mongoose";

type Locale = "ru" | "uz" | "en";

@Injectable()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  // In-memory state maps keyed by Telegram user ID (number)
  private readonly userStates = new Map<number, UserState>();
  private readonly adminStates = new Map<number, AdminState>();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Faq.name) private readonly faqModel: Model<FaqDocument>,
    @InjectModel(Request.name)
    private readonly requestModel: Model<RequestDocument>,
    @InjectModel(University.name)
    private readonly uniModel: Model<UniversityDocument>,
    @InjectModel(Faculty.name)
    private readonly facModel: Model<FacultyDocument>,
    private readonly requestsService: RequestsService,
    private readonly adminUsersService: AdminUsersService,
    private readonly i18n: BotI18nService,
    private readonly submitRequest: SubmitRequestConversation
  ) {}

  // ── Registration ────────────────────────────────────────────────────────

  /** Called by BotService.onModuleInit() - registers all handlers on the bot instance. */
  register(bot: Bot<BotContext>): void {
    // Commands
    bot.command("start", (ctx) => this.handleStart(ctx));
    bot.command("get_admin", (ctx) => this.handleGetAdmin(ctx));
    bot.command("stats", (ctx) => this.handleStats(ctx));

    // Onboarding
    bot.callbackQuery(CBRegex.ONBOARD_LANG, (ctx) =>
      this.handleOnboardLang(ctx)
    );
    bot.callbackQuery(CB.OFFER_ACCEPT, (ctx) => this.handleOfferAccept(ctx));
    bot.callbackQuery(CB.OFFER_DECLINE, (ctx) => this.handleOfferDecline(ctx));

    // University / faculty / course selection (onboarding steps 2-4)
    bot.callbackQuery(/^uni:(.+)$/, (ctx) => this.handleUniSelect(ctx));
    bot.callbackQuery(/^fac:(.+)$/, (ctx) => this.handleFacSelect(ctx));
    bot.callbackQuery(/^course:(\d+)$/, (ctx) => this.handleCourseSelect(ctx));

    // Language
    bot.callbackQuery(CBRegex.LANG, (ctx) => this.handleLangChange(ctx));

    // FAQ
    bot.callbackQuery(CBRegex.FAQ_CAT, (ctx) => this.handleFaqCategory(ctx));
    bot.callbackQuery(CBRegex.FAQ_ITEM, (ctx) => this.handleFaqItem(ctx));

    // Admin moderation callbacks
    bot.callbackQuery(CBRegex.APPROVE_REQUEST, (ctx) =>
      this.handleApproveRequest(ctx)
    );
    bot.callbackQuery(CBRegex.DECLINE_REQUEST, (ctx) =>
      this.handleDeclineRequestInit(ctx)
    );
    bot.callbackQuery(CBRegex.APPROVE_ANSWER, (ctx) =>
      this.handleApproveAnswer(ctx)
    );
    bot.callbackQuery(CBRegex.DECLINE_ANSWER, (ctx) =>
      this.handleDeclineAnswerInit(ctx)
    );

    // All text messages
    bot.on("message:text", (ctx) => this.handleText(ctx));

    // Citizen file attachments (only in private chat, attaching_files state)
    bot.on("message:photo", (ctx) => this.handleMediaMessage(ctx));
    bot.on("message:document", (ctx) => this.handleMediaMessage(ctx));

    this.logger.log("All handlers registered");
  }

  // ── /start ──────────────────────────────────────────────────────────────

  private async handleStart(ctx: BotContext): Promise<void> {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const studentChatId = process.env.TELEGRAM_STUDENT_CHAT_ID;
    const chatId = ctx.chat?.id?.toString();

    if (chatId === adminChatId || chatId === studentChatId) {
      await ctx.reply("Бот запущен.");
      return;
    }

    if (!ctx.from) return;
    const user = await this.getOrCreate(ctx);

    // ── Invite token flow: /start ref_<token> ─────────────────────────────
    const param: string = (ctx.match as string) ?? "";
    if (param.startsWith("ref_")) {
      const token = param.slice(4);
      const result = await this.adminUsersService.redeemInvite(
        token,
        ctx.from.id
      );

      if (!result.success) {
        await ctx.reply(
          "❌ Ссылка недействительна или уже использована. Попросите администратора выслать новую."
        );
        return;
      }

      if (result.alreadyStudent) {
        await ctx.reply("✅ Вы уже являетесь студентом клиники.");
      } else {
        await ctx.reply(
          "🎓 Вы успешно зарегистрированы как студент юридической клиники!\n\n" +
            "Войдите в веб-панель для начала работы."
        );
      }
      return;
    }

    if (!user.offerAccepted) {
      await this.sendOnboarding(ctx);
      return;
    }

    await ctx.reply(this.t(ctx, "commands.start.welcome_user"), {
      parse_mode: "Markdown",
      reply_markup: this.mainMenuKb(ctx),
      // @ts-ignore
      disable_web_page_preview: true,
    });
  }

  private async sendOnboarding(ctx: BotContext): Promise<void> {
    const kb = new InlineKeyboard()
      .text("🇷🇺 Русский", `${CB.ONBOARD_LANG}:ru`)
      .row()
      .text("🇺🇿 O'zbek", `${CB.ONBOARD_LANG}:uz`)
      .row()
      .text("🇺🇸 English", `${CB.ONBOARD_LANG}:en`);

    await ctx.reply(
      "🇷🇺 Добро пожаловать! Выберите язык.\n\n" +
        "🇺🇿 Xush kelibsiz! Tilni tanlang.\n\n" +
        "🇺🇸 Welcome! Choose your language.",
      { reply_markup: kb }
    );
  }

  // ── /get_admin ──────────────────────────────────────────────────────────────

  private async handleGetAdmin(ctx: BotContext): Promise<void> {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (ctx.chat?.id?.toString() !== adminChatId) return;
    if (!ctx.from) return;

    await this.userModel.updateOne(
      { telegramId: ctx.from.id },
      { $set: { role: "admin" } },
      { upsert: false }
    );

    await ctx.reply(`✅ Роль admin выдана пользователю ${ctx.from.id}`);
  }

  // ── /stats ──────────────────────────────────────────────────────────────

  private async handleStats(ctx: BotContext): Promise<void> {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (ctx.chat?.id?.toString() !== adminChatId) return;

    const [totalUsers, admins, students, requests] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ role: "admin" }),
      this.userModel.countDocuments({ role: "student" }),
      this.requestModel.find().select("status").lean(),
    ]);

    const activeStudents = await this.requestModel.distinct("studentId", {
      status: "assigned",
    });

    const counts = {
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      assigned: requests.filter((r) => r.status === "assigned").length,
      answered: requests.filter((r) => r.status === "answered").length,
      closed: requests.filter((r) => r.status === "closed").length,
      declined: requests.filter((r) => r.status === "declined").length,
    };

    const text =
      `📊 <b>Статистика бота:</b>\n\n` +
      `👥 <b>Пользователи:</b>\n` +
      `   Всего: ${totalUsers}\n` +
      `   Администраторы: ${admins}\n` +
      `   Студенты: ${students}\n` +
      `   Обычные пользователи: ${totalUsers - admins - students}\n` +
      `   Активных исполнителей: ${activeStudents.length}\n\n` +
      `📨 <b>Обращения:</b>\n` +
      `   Всего: ${requests.length}\n` +
      `   ⏳ На рассмотрении: ${counts.pending}\n` +
      `   👨‍💼 Ожидают исполнителя: ${counts.approved}\n` +
      `   🔄 В обработке: ${counts.assigned}\n` +
      `   ✅ На проверке: ${counts.answered}\n` +
      `   ✅ Закрыто: ${counts.closed}\n` +
      `   ❌ Отклонено: ${counts.declined}`;

    await ctx.reply(text, { parse_mode: "HTML" });
  }

  // ── Onboarding callbacks ─────────────────────────────────────────────────

  private async handleOnboardLang(ctx: BotContext): Promise<void> {
    const locale = ctx.match![1];
    if (!ctx.from) return;

    await this.userModel.updateOne(
      { telegramId: ctx.from.id },
      { language: locale }
    );
    ctx.locale = locale;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(this.t(ctx, "language.changed"), {
      reply_markup: { inline_keyboard: [] },
    });

    const offerKb = new InlineKeyboard()
      .text(this.t(ctx, "onboarding.accept"), CB.OFFER_ACCEPT)
      .text(this.t(ctx, "onboarding.decline"), CB.OFFER_DECLINE);

    await ctx.reply(this.t(ctx, "onboarding.offer_text"), {
      parse_mode: "Markdown",
      reply_markup: offerKb,
      // @ts-ignore - Grammy passes through API fields
      disable_web_page_preview: true,
    });
  }

  private async handleOfferAccept(ctx: BotContext): Promise<void> {
    if (!ctx.from) return;

    await this.userModel.updateOne(
      { telegramId: ctx.from.id },
      { offerAccepted: true }
    );

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(this.t(ctx, "onboarding.offer_accepted"), {
      reply_markup: { inline_keyboard: [] },
    });

    // Proceed to university selection
    await this.finishOnboarding(ctx);
  }

  private async handleOfferDecline(ctx: BotContext): Promise<void> {
    await ctx.answerCallbackQuery();

    const offerKb = new InlineKeyboard()
      .text(this.t(ctx, "onboarding.accept"), CB.OFFER_ACCEPT)
      .text(this.t(ctx, "onboarding.decline"), CB.OFFER_DECLINE);

    await ctx.editMessageText(this.t(ctx, "onboarding.offer_declined"), {
      parse_mode: "Markdown",
      reply_markup: offerKb,
      // @ts-ignore
      disable_web_page_preview: true,
    });
  }

  // ── University / faculty / course selection ──────────────────────────────

  private async sendUniSelect(ctx: BotContext): Promise<void> {
    const locale = (ctx.locale || "ru") as Locale;
    const unis = await this.uniModel
      .find({ active: true })
      .sort({ createdAt: 1 })
      .lean();

    if (!unis.length) {
      // No universities configured - skip straight to main menu
      await this.finishOnboarding(ctx);
      return;
    }

    const kb = new InlineKeyboard();
    for (const uni of unis) {
      const name = uni.names[locale] || uni.names.ru;
      kb.text(name, `uni:${uni._id}`).row();
    }

    const prompts: Record<Locale, string> = {
      ru: "🎓 Укажите ваш университет:",
      uz: "🎓 Universitetingizni tanlang:",
      en: "🎓 Select your university:",
    };
    await ctx.reply(prompts[locale], { reply_markup: kb });
  }

  private async handleUniSelect(ctx: BotContext): Promise<void> {
    if (!ctx.from) return;
    const uniId = ctx.match![1];

    await this.userModel.updateOne(
      { telegramId: ctx.from.id },
      { university: uniId, faculty: null, course: null }
    );

    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });

    // Check if this university has faculties
    const faculties = await this.facModel
      .find({ universityId: new Types.ObjectId(uniId), active: true })
      .sort({ createdAt: 1 })
      .lean();

    if (faculties.length) {
      const locale = (ctx.locale || "ru") as Locale;
      const kb = new InlineKeyboard();
      for (const fac of faculties) {
        const name = fac.names[locale] || fac.names.ru;
        kb.text(name, `fac:${fac._id}`).row();
      }
      const prompts: Record<Locale, string> = {
        ru: "📚 Укажите ваш факультет:",
        uz: "📚 Fakultetingizni tanlang:",
        en: "📚 Select your faculty:",
      };
      await ctx.reply(prompts[locale], { reply_markup: kb });
    } else {
      // No faculties - ask for course
      await this.sendCourseSelect(ctx, uniId);
    }
  }

  private async handleFacSelect(ctx: BotContext): Promise<void> {
    if (!ctx.from) return;
    const facId = ctx.match![1];

    const fac = await this.facModel.findById(facId).lean();
    if (!fac) {
      await ctx.answerCallbackQuery("Факультет не найден");
      return;
    }

    await this.userModel.updateOne(
      { telegramId: ctx.from.id },
      { faculty: facId }
    );

    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });

    // Ask for course
    await this.sendCourseSelect(ctx, String(fac.universityId));
  }

  private async sendCourseSelect(
    ctx: BotContext,
    uniId: string
  ): Promise<void> {
    const locale = (ctx.locale || "ru") as Locale;
    const uni = await this.uniModel.findById(uniId).lean();
    const courses = uni?.courses ?? [1, 2, 3, 4];

    const kb = new InlineKeyboard();
    for (const c of courses) {
      kb.text(String(c), `course:${c}`);
    }

    const prompts: Record<Locale, string> = {
      ru: "📖 Укажите ваш курс:",
      uz: "📖 Kursingizni tanlang:",
      en: "📖 Select your course:",
    };
    await ctx.reply(prompts[locale], { reply_markup: kb });
  }

  private async handleCourseSelect(ctx: BotContext): Promise<void> {
    if (!ctx.from) return;
    const course = Number(ctx.match![1]);

    await this.userModel.updateOne({ telegramId: ctx.from.id }, { course });

    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    await this.finishOnboarding(ctx);
  }

  private async finishOnboarding(ctx: BotContext): Promise<void> {
    await ctx.reply(this.t(ctx, "commands.start.welcome_user"), {
      parse_mode: "Markdown",
      reply_markup: this.mainMenuKb(ctx),
      // @ts-ignore
      disable_web_page_preview: true,
    });

    const miniAppUrl = process.env.WEB_PANEL_URL ?? "";
    if (miniAppUrl) {
      await ctx.reply(this.t(ctx, "buttons.open_app"), {
        reply_markup: new InlineKeyboard().webApp(
          "📱 Открыть приложение",
          miniAppUrl
        ),
      });
    }
  }

  // ── Language change ──────────────────────────────────────────────────────

  private async handleLangChange(ctx: BotContext): Promise<void> {
    const locale = ctx.match![1];
    if (!ctx.from) return;

    await this.userModel.updateOne(
      { telegramId: ctx.from.id },
      { language: locale }
    );
    ctx.locale = locale;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(this.t(ctx, "language.changed"), {
      reply_markup: { inline_keyboard: [] },
    });
    await ctx.reply(this.t(ctx, "lists.select_action"), {
      reply_markup: this.mainMenuKb(ctx),
    });
  }

  // ── FAQ ──────────────────────────────────────────────────────────────────

  private async handleFaqCategory(ctx: BotContext): Promise<void> {
    const categoryId = ctx.match![1];
    const faqs = await this.faqModel.find({ categoryId }).lean();

    await ctx.answerCallbackQuery();

    if (!faqs.length) {
      await ctx.reply(this.t(ctx, "errors.no_categories"));
      return;
    }

    const kb = new InlineKeyboard();
    for (const faq of faqs) {
      kb.text(faq.question.slice(0, 64), `${CB.FAQ_ITEM}:${faq._id}`).row();
    }

    await ctx.reply(this.t(ctx, "prompts.select_faq_question"), {
      reply_markup: kb,
    });
  }

  private async handleFaqItem(ctx: BotContext): Promise<void> {
    const faqId = ctx.match![1];
    const faq = await this.faqModel.findById(faqId).lean();

    await ctx.answerCallbackQuery();

    if (!faq) {
      await ctx.reply(this.t(ctx, "errors.not_found"));
      return;
    }

    await ctx.reply(`❓ ${faq.question}\n\n💬 ${faq.answer}`);
    await ctx.reply(this.t(ctx, "lists.select_action"), {
      reply_markup: this.mainMenuKb(ctx),
    });
  }

  // ── Admin: approve / decline request ────────────────────────────────────

  private async handleApproveRequest(ctx: BotContext): Promise<void> {
    const requestId = ctx.match![1];
    try {
      await this.requestsService.approve(requestId);
      await ctx.answerCallbackQuery("✅ Одобрено");
      await ctx.editMessageText(
        this.originalText(ctx) + "\n\n✅ <b>Одобрено</b>",
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } }
      );
    } catch (e) {
      await ctx.answerCallbackQuery(`Ошибка: ${(e as Error).message}`);
    }
  }

  private async handleDeclineRequestInit(ctx: BotContext): Promise<void> {
    const requestId = ctx.match![1];
    if (!ctx.from) return;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      this.originalText(ctx) + "\n\n⏳ Введите причину отклонения...",
      { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } }
    );

    const prompt = await ctx.reply(
      `Введите причину отклонения обращения #${requestId}:`
    );

    this.adminStates.set(ctx.from.id, {
      state: "entering_decline_reason",
      requestId,
      promptMessageId: prompt.message_id,
    });
  }

  // ── Admin: approve / decline answer ─────────────────────────────────────

  private async handleApproveAnswer(ctx: BotContext): Promise<void> {
    const requestId = ctx.match![1];
    try {
      await this.requestsService.approveAnswer(requestId);
      await ctx.answerCallbackQuery("✅ Ответ одобрен и отправлен");
      await ctx.editMessageText(
        this.originalText(ctx) + "\n\n✅ <b>Ответ одобрен</b>",
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } }
      );
    } catch (e) {
      await ctx.answerCallbackQuery(`Ошибка: ${(e as Error).message}`);
    }
  }

  private async handleDeclineAnswerInit(ctx: BotContext): Promise<void> {
    const requestId = ctx.match![1];
    if (!ctx.from) return;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      this.originalText(ctx) + "\n\n⏳ Введите комментарий для студента...",
      { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } }
    );

    const prompt = await ctx.reply(
      `Введите комментарий для студента по обращению #${requestId}:`
    );

    this.adminStates.set(ctx.from.id, {
      state: "entering_answer_decline_reason",
      requestId,
      promptMessageId: prompt.message_id,
    });
  }

  // ── Text message router ──────────────────────────────────────────────────

  private async handleText(ctx: BotContext): Promise<void> {
    if (!ctx.from || !ctx.message?.text) return;

    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const studentChatId = process.env.TELEGRAM_STUDENT_CHAT_ID;
    const chatId = ctx.chat?.id?.toString();
    const text = ctx.message.text;

    // ── Admin group chat ─────────────────────────────────────────────────
    if (chatId === adminChatId) {
      const adminState = this.adminStates.get(ctx.from.id);
      if (adminState?.state === "entering_decline_reason") {
        return this.handleDeclineReasonText(ctx, adminState.requestId);
      }
      if (adminState?.state === "entering_answer_decline_reason") {
        return this.handleDeclineAnswerReasonText(ctx, adminState.requestId);
      }
      return;
    }

    // ── Student group chat: ignore all messages ──────────────────────────
    if (chatId === studentChatId) return;

    // ── Private chat ─────────────────────────────────────────────────────

    // Offer guard - all non-command messages require accepted offer
    if (!text.startsWith("/")) {
      const dbUser = await this.userModel
        .findOne({ telegramId: ctx.from.id })
        .select("offerAccepted")
        .lean();
      if (!dbUser?.offerAccepted) {
        await ctx.reply(this.t(ctx, "onboarding.offer_required"));
        return;
      }
    }

    const userState = this.userStates.get(ctx.from.id);

    // ── Back button ──────────────────────────────────────────────────────
    if (text === this.t(ctx, "buttons.back")) {
      this.userStates.delete(ctx.from.id);
      await ctx.reply(this.t(ctx, "lists.select_action"), {
        reply_markup: this.mainMenuKb(ctx),
      });
      return;
    }

    // ── Submit request conversation ───────────────────────────────────────
    if (text === this.t(ctx, "buttons.ask_question")) {
      await this.submitRequest.start(ctx, this.userStates);
      return;
    }

    if (text === this.t(ctx, "buttons.faq")) {
      await this.handleFaqMenu(ctx);
      return;
    }

    if (userState?.state === "selecting_category") {
      await this.submitRequest.onCategorySelected(ctx, text, this.userStates);
      return;
    }

    if (userState?.state === "entering_request") {
      await this.submitRequest.onRequestText(
        ctx,
        text,
        userState,
        this.userStates
      );
      return;
    }

    // ── Attaching files step ──────────────────────────────────────────────
    if (userState?.state === "attaching_files") {
      const continueLabel = this.submitRequest.getContinueLabel(
        ctx.locale || "ru"
      );
      if (text === continueLabel || text === this.t(ctx, "buttons.confirm")) {
        await this.submitRequest.onContinue(ctx, userState, this.userStates);
        return;
      }
      await ctx.reply("Отправьте файл или нажмите кнопку «Продолжить».", {
        reply_markup: new Keyboard()
          .text(continueLabel)
          .row()
          .text(this.t(ctx, "buttons.back"))
          .resized(),
      });
      return;
    }

    if (userState?.state === "confirming_request") {
      if (text === this.t(ctx, "buttons.confirm")) {
        const user = await this.getOrCreate(ctx);
        await this.submitRequest.onConfirm(
          ctx,
          userState,
          user._id as any,
          this.userStates,
          () => this.mainMenuKb(ctx)
        );
        return;
      }
      if (text === this.t(ctx, "buttons.edit")) {
        await this.submitRequest.onEdit(ctx, userState, this.userStates);
        return;
      }
    }

    // ── Other main menu buttons ───────────────────────────────────────────
    if (text === this.t(ctx, "buttons.my_requests")) {
      await this.handleMyRequests(ctx);
      return;
    }

    if (
      text === this.t(ctx, "buttons.help") ||
      text === "❓ Help" ||
      text === "❓ Yordam"
    ) {
      await this.handleHelp(ctx);
      return;
    }

    if (
      text === "🇷🇺 Русский" ||
      text === "🇺🇿 O'zbek" ||
      text === "🇺🇸 English" ||
      text === "🌐 Language" // fallback для старых сессий
    ) {
      await this.handleLanguageMenu(ctx);
      return;
    }

    // ── FAQ text-based category selection ─────────────────────────────────
    if (userState?.state === "selecting_faq_category") {
      await this.handleFaqCategoryByName(ctx, text);
      return;
    }

    // Fallback
    await ctx.reply(this.t(ctx, "lists.select_action"), {
      reply_markup: this.mainMenuKb(ctx),
    });
  }

  // ── Media messages (photo / document) ───────────────────────────────────

  private async handleMediaMessage(ctx: BotContext): Promise<void> {
    if (!ctx.from) return;

    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const studentChatId = process.env.TELEGRAM_STUDENT_CHAT_ID;
    const chatId = ctx.chat?.id?.toString();

    if (chatId === adminChatId || chatId === studentChatId) return;

    const userState = this.userStates.get(ctx.from.id);
    if (userState?.state === "attaching_files") {
      await this.submitRequest.onFileReceived(ctx, userState, this.userStates);
    }
  }

  // ── Admin text state completions ─────────────────────────────────────────

  private async handleDeclineReasonText(
    ctx: BotContext,
    requestId: string
  ): Promise<void> {
    if (!ctx.from || !ctx.message?.text) return;
    const reason = ctx.message.text;
    this.adminStates.delete(ctx.from.id);

    try {
      await this.requestsService.reject(requestId, reason);
      await ctx.reply(
        `✅ Обращение #${requestId} отклонено.\nПричина: ${reason}`
      );
    } catch (e) {
      await ctx.reply(`❌ Ошибка: ${(e as Error).message}`);
    }
  }

  private async handleDeclineAnswerReasonText(
    ctx: BotContext,
    requestId: string
  ): Promise<void> {
    if (!ctx.from || !ctx.message?.text) return;
    const comment = ctx.message.text;
    this.adminStates.delete(ctx.from.id);

    try {
      await this.requestsService.rejectAnswer(requestId, comment);
      await ctx.reply(
        `✅ Ответ по обращению #${requestId} возвращён на доработку.\nКомментарий студенту: ${comment}`
      );
    } catch (e) {
      await ctx.reply(`❌ Ошибка: ${(e as Error).message}`);
    }
  }

  // ── Citizen: my requests ──────────────────────────────────────────────────

  private async handleMyRequests(ctx: BotContext): Promise<void> {
    if (!ctx.from) return;
    const user = await this.getOrCreate(ctx);

    const requests = await this.requestModel
      .find({ userId: user._id })
      .sort({ createdAt: -1 })
      .populate("categoryId", "name")
      .lean();

    if (!requests.length) {
      await ctx.reply(this.t(ctx, "lists.no_requests"), {
        reply_markup: this.mainMenuKb(ctx),
      });
      return;
    }

    let message = this.t(ctx, "lists.my_requests_title") + "\n\n";

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i] as any;
      const date = new Date(req.createdAt).toLocaleDateString("ru-RU");
      const cat = req.categoryId?.name ?? "-";
      const status = this.t(ctx, `statuses.${req.status}`);

      message += `${i + 1}. ${cat} - ${status}\n`;
      message += `   ${this.t(ctx, "lists.request_date")} ${date}\n`;

      if (req.status === "closed" && req.finalAnswerText) {
        const preview = req.finalAnswerText.slice(0, 150);
        const suffix = req.finalAnswerText.length > 150 ? "..." : "";
        message += `   ${this.t(
          ctx,
          "lists.answer_label"
        )} ${preview}${suffix}\n`;
      }

      if (req.status === "declined" && req.declineReason) {
        message += `   ${this.t(ctx, "lists.comment_label")} ${
          req.declineReason
        }\n`;
      }

      message += "\n";
    }

    const miniAppUrl = process.env.WEB_PANEL_URL ?? "";

    await ctx.reply(message, {
      reply_markup: miniAppUrl
        ? new InlineKeyboard().webApp(
            this.t(ctx, "buttons.open_app"),
            miniAppUrl
          )
        : undefined,
    });
  }

  // ── Citizen: help & language ──────────────────────────────────────────────

  private async handleHelp(ctx: BotContext): Promise<void> {
    await ctx.reply(this.t(ctx, "help.user"), {
      parse_mode: "Markdown",
      // @ts-ignore
      disable_web_page_preview: true,
      reply_markup: this.mainMenuKb(ctx),
    });
  }

  private async handleLanguageMenu(ctx: BotContext): Promise<void> {
    const kb = new InlineKeyboard()
      .text("🇷🇺 Русский", `${CB.LANG}:ru`)
      .row()
      .text("🇺🇿 O'zbek", `${CB.LANG}:uz`)
      .row()
      .text("🇺🇸 English", `${CB.LANG}:en`);

    await ctx.reply(this.t(ctx, "language.select"), { reply_markup: kb });
  }

  // ── Citizen: faq ──────────────────────────────────────────────

  private async handleFaqCategoryByName(
    ctx: BotContext,
    categoryName: string
  ): Promise<void> {
    if (!ctx.from) return;
    const mongoose = await import("mongoose");
    const category = await mongoose.default
      .model("Category")
      .findOne({ name: categoryName })
      .lean();

    if (!category) {
      await ctx.reply(this.t(ctx, "errors.category_not_found"));
      return;
    }

    const faqs = await this.faqModel
      .find({ categoryId: (category as any)._id })
      .lean();

    if (!faqs.length) {
      await ctx.reply(this.t(ctx, "errors.no_categories"));
      return;
    }

    const kb = new InlineKeyboard();
    for (const faq of faqs) {
      kb.text(faq.question.slice(0, 64), `${CB.FAQ_ITEM}:${faq._id}`).row();
    }

    this.userStates.delete(ctx.from.id);
    await ctx.reply(this.t(ctx, "prompts.select_faq_question"), {
      reply_markup: kb,
    });
  }

  private async handleFaqMenu(ctx: BotContext): Promise<void> {
    const locale = (ctx.locale || "ru") as Locale;

    const categories = (await mongoose
      .model("Category")
      .find()
      .lean()) as any[];
    if (!categories.length) {
      await ctx.reply(this.t(ctx, "errors.no_categories"), {
        reply_markup: this.mainMenuKb(ctx),
      });
      return;
    }

    const kb = new InlineKeyboard();
    for (const cat of categories) {
      const name = cat.names?.[locale] || cat.names?.ru || cat.name;
      kb.text(name, `${CB.FAQ_CAT}:${cat._id}`).row();
    }

    await ctx.reply(
      this.t(ctx, "prompts.select_faq_category") ?? "📚 Выберите категорию:",
      {
        reply_markup: kb,
      }
    );
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  private t(
    ctx: BotContext,
    key: string,
    vars?: Record<string, string | number>
  ): string {
    return this.i18n.t(ctx.locale, key, vars);
  }

  private async getOrCreate(ctx: BotContext): Promise<UserDocument> {
    if (!ctx.from) throw new Error("No from in context");
    let user = await this.userModel.findOne({ telegramId: ctx.from.id });
    if (!user) {
      user = await this.userModel.create({
        telegramId: ctx.from.id,
        firstName: ctx.from.first_name ?? "",
        lastName: ctx.from.last_name ?? "",
        username: ctx.from.username ?? "",
        language: ctx.locale || "ru",
      });
    }
    return user;
  }

  mainMenuKb(ctx: BotContext) {
    const LOCALE_FLAGS: Record<string, string> = {
      ru: "🇷🇺 Русский",
      uz: "🇺🇿 O'zbek",
      en: "🇺🇸 English",
    };
    const langLabel = LOCALE_FLAGS[ctx.locale ?? "ru"] ?? "🌐 Language";

    return new Keyboard()
      .text(this.t(ctx, "buttons.ask_question"))
      .row()
      .text(this.t(ctx, "buttons.faq"))
      .text(this.t(ctx, "buttons.my_requests"))
      .row()
      .text(this.t(ctx, "buttons.help"))
      .text(langLabel)
      .resized();
  }

  /** Safely extracts the original text from a callback query message. */
  private originalText(ctx: BotContext): string {
    return (ctx.callbackQuery?.message as any)?.text ?? "";
  }
}
