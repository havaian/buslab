import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Keyboard } from "grammy";
import { BotContext } from "../context.type";
import { UserState } from "../states.type";
import { BotI18nService } from "../bot-i18n.service";
import { NotificationsService } from "../../notifications/notifications.service";
import {
  Category,
  CategoryDocument,
} from "../../categories/schemas/category.schema";
import {
  REQUEST_MIN_LENGTH,
  STUDENT_CHAT_PREVIEW_LENGTH,
} from "../bot.constants";

/**
 * Handles the multi-step "submit a request" flow for citizens.
 *
 * State transitions:
 *   idle
 *     → selecting_category   (user presses "Задать вопрос")
 *     → entering_request     (user picks a category)
 *     → confirming_request   (user enters text ≥ 150 chars)
 *     → idle                 (user confirms → request created)
 *
 * The state map lives in BotUpdate and is passed by reference on every call
 * so this service stays stateless and NestJS-friendly.
 */
@Injectable()
export class SubmitRequestConversation {
  private readonly logger = new Logger(SubmitRequestConversation.name);

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
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

  /** Called when citizen presses "Задать вопрос". */
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
    for (const cat of categories) {
      kb.text(cat.name).row();
    }
    kb.text(this.t(ctx, "buttons.back"));

    userStates.set(ctx.from!.id, { state: "selecting_category" });

    await ctx.reply(this.t(ctx, "prompts.select_category"), {
      reply_markup: kb.resized(),
    });
  }

  // ── Category selected ──────────────────────────────────────────────────

  /** Called when user types a category name while in selecting_category. */
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

  /** Called when user sends text while in entering_request. */
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

    userStates.set(ctx.from!.id, {
      state: "confirming_request",
      categoryId: state.categoryId,
      categoryName: state.categoryName,
      requestText: text,
    });

    const confirmKb = new Keyboard()
      .text(this.t(ctx, "buttons.confirm"))
      .row()
      .text(this.t(ctx, "buttons.edit"))
      .row()
      .text(this.t(ctx, "buttons.back"))
      .resized();

    await ctx.reply(`${this.t(ctx, "prompts.confirm_request")}\n\n${text}`, {
      reply_markup: confirmKb,
    });
  }

  // ── Edit: go back to entering text ────────────────────────────────────

  async onEdit(
    ctx: BotContext,
    state: Extract<UserState, { state: "confirming_request" }>,
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

  /**
   * Called when user presses "Подтвердить" in confirming_request.
   * Creates the Request document directly via Mongoose and notifies admin chat.
   */
  async onConfirm(
    ctx: BotContext,
    state: Extract<UserState, { state: "confirming_request" }>,
    userId: Types.ObjectId,
    userStates: Map<number, UserState>,
    mainMenuKeyboard: () => any
  ): Promise<void> {
    userStates.delete(ctx.from!.id);

    try {
      // Import at call-time to avoid circular NestJS module dependency
      const mongoose = await import("mongoose");
      const newRequest = await mongoose.default.model("Request").create({
        userId,
        categoryId: new mongoose.default.Types.ObjectId(state.categoryId),
        text: state.requestText,
        status: "pending",
      });

      // Notify admin chat — includes approve/decline inline buttons
      // (those are handled by BotUpdate.handleApproveRequest / handleDeclineRequestInit)
      await this.notifications.notifyAdminNewRequest(
        String(newRequest._id),
        state.categoryName,
        state.requestText.slice(0, STUDENT_CHAT_PREVIEW_LENGTH)
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

  // ── Helpers ───────────────────────────────────────────────────────────

  private backKeyboard(ctx: BotContext) {
    return new Keyboard().text(this.t(ctx, "buttons.back")).resized();
  }
}
