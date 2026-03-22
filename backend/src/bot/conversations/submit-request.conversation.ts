import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Keyboard } from "grammy";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { BotContext } from "../context.type";
import { UserState } from "../states.type";
import { BotI18nService } from "../bot-i18n.service";
import { NotificationsService } from "../../notifications/notifications.service";
import {
  Category,
  CategoryDocument,
} from "../../categories/schemas/category.schema";
import {
  Request,
  RequestDocument,
} from "../../requests/schemas/request.schema";
import {
  REQUEST_MIN_LENGTH,
  STUDENT_CHAT_PREVIEW_LENGTH,
} from "../bot.constants";

type AttachingState = Extract<UserState, { state: "attaching_files" }>;
type ConfirmingState = Extract<UserState, { state: "confirming_request" }>;

const UPLOADS_DIR = join(process.cwd(), "uploads");

const ATTACH_PROMPTS: Record<string, string> = {
  ru: "📎 Хотите прикрепить документы или фотографии?\n\nОтправьте файлы (PDF, фото) или нажмите «Продолжить».",
  uz: "📎 Hujjat yoki rasm biriktirmoqchimisiz?\n\nFayl yuboring (PDF, rasm) yoki «Davom etish» tugmasini bosing.",
  en: "📎 Would you like to attach documents or photos?\n\nSend files (PDF, photos) or press «Continue».",
};
const CONTINUE_LABELS: Record<string, string> = {
  ru: "✅ Продолжить",
  uz: "✅ Davom etish",
  en: "✅ Continue",
};

@Injectable()
export class SubmitRequestConversation {
  private readonly logger = new Logger(SubmitRequestConversation.name);

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Request.name)
    private readonly requestModel: Model<RequestDocument>,
    private readonly notifications: NotificationsService,
    private readonly i18n: BotI18nService
  ) {}

  private t(
    ctx: BotContext,
    key: string,
    vars?: Record<string, string | number>
  ): string {
    return this.i18n.t(ctx.locale, key, vars);
  }

  // ── Entry point ────────────────────────────────────────────────────────

  async start(
    ctx: BotContext,
    userStates: Map<number, UserState>
  ): Promise<void> {
    const categories = await this.categoryModel.find().sort({ name: 1 }).lean();

    if (!categories.length) {
      await ctx.reply(this.t(ctx, "errors.no_categories"));
      return;
    }

    const kb = new Keyboard();
    for (const cat of categories) kb.text(cat.name).row();
    kb.text(this.t(ctx, "buttons.back"));

    userStates.set(ctx.from!.id, { state: "selecting_category" });
    await ctx.reply(this.t(ctx, "prompts.select_category"), {
      reply_markup: kb.resized(),
    });
  }

  // ── Category selected ──────────────────────────────────────────────────

  async onCategorySelected(
    ctx: BotContext,
    categoryName: string,
    userStates: Map<number, UserState>
  ): Promise<void> {
    const category = await this.categoryModel
      .findOne({ name: categoryName })
      .lean();

    if (!category) {
      await ctx.reply(this.t(ctx, "errors.category_not_found"));
      return;
    }

    userStates.set(ctx.from!.id, {
      state: "entering_request",
      categoryId: String(category._id),
      categoryName: category.name,
    });

    await ctx.reply(this.t(ctx, "prompts.enter_request"), {
      reply_markup: this.backKeyboard(ctx),
    });
  }

  // ── Request text entered ───────────────────────────────────────────────

  async onRequestText(
    ctx: BotContext,
    text: string,
    state: Extract<UserState, { state: "entering_request" }>,
    userStates: Map<number, UserState>
  ): Promise<void> {
    if (text.length < REQUEST_MIN_LENGTH) {
      await ctx.reply(
        this.t(ctx, "errors.invalid_length", { min: REQUEST_MIN_LENGTH })
      );
      return;
    }

    // Move to file attachment step
    userStates.set(ctx.from!.id, {
      state: "attaching_files",
      categoryId: state.categoryId,
      categoryName: state.categoryName,
      requestText: text,
      requestFiles: [],
    });

    const locale = ctx.locale || "ru";
    const continueLabel = CONTINUE_LABELS[locale] || CONTINUE_LABELS.ru;

    const kb = new Keyboard()
      .text(continueLabel)
      .row()
      .text(this.t(ctx, "buttons.back"))
      .resized();

    await ctx.reply(ATTACH_PROMPTS[locale] || ATTACH_PROMPTS.ru, {
      reply_markup: kb,
    });
  }

  // ── File received ──────────────────────────────────────────────────────

  /**
   * Called from bot.update.ts when a photo or document arrives in attaching_files state.
   * Downloads the file via Grammy, saves to shared uploads dir, updates state.
   */
  async onFileReceived(
    ctx: BotContext,
    state: AttachingState,
    userStates: Map<number, UserState>
  ): Promise<void> {
    let fileId: string;
    let originalName: string;
    let mimeType: string;

    if (ctx.message?.document) {
      fileId = ctx.message.document.file_id;
      originalName = ctx.message.document.file_name || "document";
      mimeType = ctx.message.document.mime_type || "application/octet-stream";
    } else if (ctx.message?.photo) {
      const largest = ctx.message.photo[ctx.message.photo.length - 1];
      fileId = largest.file_id;
      originalName = `photo_${Date.now()}.jpg`;
      mimeType = "image/jpeg";
    } else {
      return;
    }

    try {
      if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

      const file = await ctx.api.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Telegram file fetch failed: ${res.status}`);

      const buf = Buffer.from(await res.arrayBuffer());
      const ext =
        extname(originalName) || (mimeType === "image/jpeg" ? ".jpg" : "");
      const filename = `${uuidv4()}${ext}`;
      writeFileSync(join(UPLOADS_DIR, filename), buf);

      const updatedFiles = [
        ...state.requestFiles,
        { fileId, originalName, mimeType },
      ];

      // Store filename in state as well so we can use it on save
      // We'll use a side-channel: encode filename into originalName for now,
      // or store as extra field (TypeScript won't complain since we cast)
      const updatedState: any = {
        ...state,
        requestFiles: updatedFiles.map((f, i) =>
          i === updatedFiles.length - 1
            ? { ...f, savedFilename: filename }
            : (state.requestFiles[i] as any)
        ),
      };
      userStates.set(ctx.from!.id, updatedState);

      const locale = ctx.locale || "ru";
      const continueLabel = CONTINUE_LABELS[locale] || CONTINUE_LABELS.ru;
      const kb = new Keyboard()
        .text(continueLabel)
        .row()
        .text(this.t(ctx, "buttons.back"))
        .resized();

      const countMsg = {
        ru: `✅ Файл прикреплён (${updatedFiles.length}). Можно отправить ещё или нажать «Продолжить».`,
        uz: `✅ Fayl biriktirildi (${updatedFiles.length}). Yana yuboring yoki «Davom etish» tugmasini bosing.`,
        en: `✅ File attached (${updatedFiles.length}). Send more or press «Continue».`,
      };
      await ctx.reply(countMsg[locale] || countMsg.ru, { reply_markup: kb });
    } catch (err) {
      this.logger.error("onFileReceived error:", err);
      await ctx.reply("⚠️ Не удалось сохранить файл. Попробуйте ещё раз.");
    }
  }

  // ── Continue (skip or after files) ────────────────────────────────────

  async onContinue(
    ctx: BotContext,
    state: AttachingState,
    userStates: Map<number, UserState>
  ): Promise<void> {
    userStates.set(ctx.from!.id, {
      state: "confirming_request",
      categoryId: state.categoryId,
      categoryName: state.categoryName,
      requestText: state.requestText,
      requestFiles: state.requestFiles,
    });

    const filesSummary = (state.requestFiles as any[]).length
      ? `\n\n📎 Прикреплено файлов: ${(state.requestFiles as any[]).length}`
      : "";

    const confirmKb = new Keyboard()
      .text(this.t(ctx, "buttons.confirm"))
      .row()
      .text(this.t(ctx, "buttons.edit"))
      .row()
      .text(this.t(ctx, "buttons.back"))
      .resized();

    await ctx.reply(
      `${this.t(ctx, "prompts.confirm_request")}\n\n${
        state.requestText
      }${filesSummary}`,
      { reply_markup: confirmKb }
    );
  }

  // ── Edit: go back to entering text ────────────────────────────────────

  async onEdit(
    ctx: BotContext,
    state: ConfirmingState,
    userStates: Map<number, UserState>
  ): Promise<void> {
    userStates.set(ctx.from!.id, {
      state: "entering_request",
      categoryId: state.categoryId,
      categoryName: state.categoryName,
    });

    await ctx.reply(this.t(ctx, "prompts.enter_request"), {
      reply_markup: this.backKeyboard(ctx),
    });
  }

  // ── Confirm: create request ───────────────────────────────────────────

  async onConfirm(
    ctx: BotContext,
    state: ConfirmingState,
    userId: Types.ObjectId,
    userStates: Map<number, UserState>,
    mainMenuKeyboard: () => any
  ): Promise<void> {
    userStates.delete(ctx.from!.id);

    try {
      const requestFiles = (state.requestFiles as any[]).map((f) => ({
        filename: f.savedFilename || f.fileId,
        originalName: f.originalName,
        mimetype: f.mimeType,
        size: 0,
        ref: f.savedFilename || f.fileId,
        source: "telegram",
      }));

      const newRequest = await this.requestModel.create({
        userId,
        categoryId: new Types.ObjectId(state.categoryId),
        text: state.requestText,
        status: "pending",
        requestFiles,
      });

      const filesNote = requestFiles.length
        ? `\n📎 Прикреплено файлов: ${requestFiles.length}`
        : "";

      await this.notifications.notifyAdminNewRequest(
        String(newRequest._id),
        state.categoryName,
        state.requestText.slice(0, STUDENT_CHAT_PREVIEW_LENGTH) + filesNote
      );

      await ctx.reply(this.t(ctx, "success.request_sent"), {
        reply_markup: mainMenuKeyboard(),
      });
    } catch (e) {
      this.logger.error("Failed to create citizen request:", e);
      await ctx.reply(this.t(ctx, "errors.general"), {
        reply_markup: mainMenuKeyboard(),
      });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private backKeyboard(ctx: BotContext) {
    return new Keyboard().text(this.t(ctx, "buttons.back")).resized();
  }

  /** Returns the continue button label for the user's locale. */
  getContinueLabel(locale: string): string {
    return CONTINUE_LABELS[locale] || CONTINUE_LABELS.ru;
  }
}
