import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

const TELEGRAM_API = "https://api.telegram.org";

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private readonly adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  private readonly studentChatId = process.env.TELEGRAM_STUDENT_CHAT_ID;
  private readonly webPanelUrl = process.env.WEB_PANEL_URL || "";

  private readonly botName = process.env.TELEGRAM_BOT_USERNAME || "";
  private readonly appName = process.env.TELEGRAM_APP_NAME || "";

  // Генерирует Mini App deep link если бот/апп настроены,
  // иначе fallback на веб-панель
  private appLink(param: string): string {
    if (this.botName && this.appName) {
      return `https://t.me/${this.botName}/${
        this.appName
      }?startapp=${encodeURIComponent(param)}`;
    }
    return `${this.webPanelUrl}`;
  }

  onModuleInit() {
    this.logger.log(`TELEGRAM_BOT_TOKEN: ${this.token ? "SET" : "⚠️ MISSING"}`);
    this.logger.log(
      `TELEGRAM_ADMIN_CHAT_ID: ${this.adminChatId || "⚠️ MISSING"}`
    );
    this.logger.log(
      `TELEGRAM_STUDENT_CHAT_ID: ${this.studentChatId || "⚠️ MISSING"}`
    );
    this.logger.log(`WEB_PANEL_URL: ${this.webPanelUrl || "⚠️ MISSING"}`);
  }

  // ── Core primitives ───────────────────────────────────────────────────────

  private async send(chatId: string, text: string): Promise<void> {
    await this.sendWithResponse(chatId, text);
  }

  /** Sends a message and returns message_id from Telegram, or null on failure. */
  async sendWithResponse(
    chatId: string,
    text: string,
    replyMarkup?: object
  ): Promise<number | null> {
    if (!this.token) {
      this.logger.warn("sendWithResponse skipped: TELEGRAM_BOT_TOKEN not set");
      return null;
    }
    if (!chatId) {
      this.logger.warn("sendWithResponse skipped: chatId is empty");
      return null;
    }
    try {
      const url = `${TELEGRAM_API}/bot${this.token}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      });
      const data = (await res.json()) as any;
      if (!data.ok) {
        this.logger.error(
          `Telegram API error → chat ${chatId}: [${data.error_code}] ${data.description}`
        );
        return null;
      }
      return data?.result?.message_id ?? null;
    } catch (e) {
      this.logger.error(
        `Failed to send Telegram message to ${chatId}: ${e.message}`
      );
      return null;
    }
  }

  /** Edits text of an existing message (removes inline keyboard). */
  async editMessage(
    chatId: string,
    messageId: number,
    text: string
  ): Promise<void> {
    if (!this.token || !chatId || !messageId) return;
    try {
      const url = `${TELEGRAM_API}/bot${this.token}/editMessageText`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: [] },
        }),
      });
    } catch (e) {
      // Editing can fail if the message is too old or already deleted - non-fatal
      this.logger.warn(
        `Failed to edit message ${messageId} in ${chatId}: ${e.message}`
      );
    }
  }

  /**
   * Splits text into chunks ≤ maxLen following §7 rules:
   * double newlines → single newlines → spaces → hard cut.
   */
  private splitMessage(text: string, maxLen = 4096): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLen) {
      let splitAt = remaining.lastIndexOf("\n\n", maxLen);
      if (splitAt < 1) splitAt = remaining.lastIndexOf("\n", maxLen);
      if (splitAt < 1) splitAt = remaining.lastIndexOf(" ", maxLen);
      if (splitAt < 1) splitAt = maxLen;

      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }

    if (remaining.length > 0) chunks.push(remaining);
    return chunks;
  }

  // ── Admin chat ────────────────────────────────────────────────────────────

  async notifyAdminNewRequest(
    requestId: string,
    category: string,
    text: string
  ): Promise<number | null> {
    const link = this.appLink(`r_${requestId}`);
    return this.sendWithResponse(
      this.adminChatId,
      `📩 <b>Новое обращение</b>\nКатегория: ${category}\n${text}\n\n<a href="${link}">Открыть в панели →</a>`
    );
  }

  async notifyAdminAnswerSubmitted(
    requestId: string,
    studentName: string,
    category: string
  ): Promise<number | null> {
    const link = this.appLink(`r_${requestId}`);
    return this.sendWithResponse(
      this.adminChatId,
      `⚠️ <b>Студент отправил ответ</b>\nСтудент: ${studentName}\nКатегория: ${category}\n\n<a href="${link}">Проверить →</a>`
    );
  }

  async notifyAdminTimerExpired(requestId: string, studentName: string) {
    const link = this.appLink(`r_${requestId}`);
    await this.send(
      this.adminChatId,
      `⏰ <b>Таймер истёк</b>\nСтудент: ${studentName} не уложился в срок\n\n<a href="${link}">Открыть обращение →</a>`
    );
  }

  async notifyAdminStudentDeclined(requestId: string, studentName: string) {
    const link = this.appLink(`r_${requestId}`);
    await this.send(
      this.adminChatId,
      `↩️ <b>Студент отказался от обращения</b>\nСтудент: ${studentName}\n\n<a href="${link}">Открыть обращение →</a>`
    );
  }

  async notifyAdminReturnedToQueue(
    requestId: string,
    category: string,
    shortText: string
  ): Promise<void> {
    const link = this.appLink(`r_${requestId}`);
    await this.send(
      this.adminChatId,
      `🔄 <b>Обращение возвращено в очередь</b>\nКатегория: ${category}\n${shortText}\n\n<a href="${link}">Открыть в панели →</a>`
    );
  }

  async editAdminRequestStatus(
    messageId: number,
    requestId: string,
    category: string,
    text: string,
    statusLine: string
  ): Promise<void> {
    const link = this.appLink(`r_${requestId}`);
    const newText = `📩 <b>Новое обращение</b>\nКатегория: ${category}\n${text}\n\n<a href="${link}">Открыть в панели →</a>\n\n${statusLine}`;
    await this.editMessage(this.adminChatId, messageId, newText);
  }

  async editAdminAnswerStatus(
    messageId: number,
    requestId: string,
    studentName: string,
    category: string,
    statusLine: string
  ): Promise<void> {
    const link = this.appLink(`r_${requestId}`);
    const newText = `⚠️ <b>Студент отправил ответ</b>\nСтудент: ${studentName}\nКатегория: ${category}\n\n<a href="${link}">Проверить →</a>\n\n${statusLine}`;
    await this.editMessage(this.adminChatId, messageId, newText);
  }

  // ── Student chat ──────────────────────────────────────────────────────────

  /**
   * Posts a new "available request" announcement in the student chat.
   * Uses a URL button linking to the web panel (no callback_data).
   * Returns the Telegram message_id so it can be stored and later edited.
   */
  async notifyStudentChatApproved(
    requestId: string,
    category: string,
    shortText: string
  ): Promise<number | null> {
    const link = this.appLink(`take_${requestId}`);
    const text = `📋 <b>Новое обращение доступно</b>\nКатегория: ${category}\n${shortText}`;
    return this.sendWithResponse(this.studentChatId, text, {
      inline_keyboard: [[{ text: "🔄 Взять в работу", url: link }]],
    });
  }

  /**
   * Posts a "returned to queue" announcement in the student chat (fresh message
   * with URL button). Returns the new message_id.
   */
  async notifyStudentChatReturned(
    requestId: string,
    category: string,
    shortText: string
  ): Promise<number | null> {
    const link = this.appLink(`take_${requestId}`);
    const text = `🔄 <b>Обращение возвращено в очередь</b>\nКатегория: ${category}\n${shortText}`;
    return this.sendWithResponse(this.studentChatId, text, {
      inline_keyboard: [[{ text: "🔄 Взять в работу", url: link }]],
    });
  }

  /**
   * Edits the student chat announcement after a student takes the request via web.
   * Reconstructs the message text from the request data and adds "Взято: [name]".
   */
  async updateStudentChatTaken(
    messageId: number,
    category: string,
    shortText: string,
    studentName: string
  ): Promise<void> {
    await this.editMessage(
      this.studentChatId,
      messageId,
      `📋 <b>Обращение взято в работу</b>\nКатегория: ${category}\n${shortText}\n\n✅ <b>Взято: ${studentName}</b>`
    );
  }

  // ── Personal to student ───────────────────────────────────────────────────

  async notifyStudentAssigned(
    telegramId: string,
    requestId: string,
    shortText: string
  ) {
    const link = this.appLink(`tasks`);
    await this.send(
      telegramId,
      `📌 <b>Вам назначено обращение</b>\n${shortText}\n\n<a href="${link}">Открыть задание →</a>`
    );
  }

  async notifyStudentAnswerApproved(telegramId: string, requestId: string) {
    const link = this.appLink(`history`);
    await this.send(
      telegramId,
      `✅ Ваш ответ одобрен и отправлен пользователю\n\n<a href="${link}">История →</a>`
    );
  }

  async notifyStudentAnswerRejected(
    telegramId: string,
    requestId: string,
    comment: string
  ) {
    const link = this.appLink(`tasks`);
    await this.send(
      telegramId,
      `❌ <b>Ваш ответ отклонён</b>\nКомментарий: ${comment}\n\n<a href="${link}">Исправить →</a>`
    );
  }

  async notifyStudentUnassigned(telegramId: string) {
    await this.send(telegramId, `ℹ️ Администратор снял с вас задание`);
  }

  async notifyStudentReturnedToQueue(telegramId: string) {
    await this.send(
      telegramId,
      `🔄 Обращение возвращено в очередь администратором`
    );
  }

  async notifyStudentTimerHalfWarning(
    telegramId: string,
    requestId: string,
    hoursLeft: number
  ) {
    const link = this.appLink(`tasks`);
    await this.send(
      telegramId,
      `⏳ Истекла половина срока выполнения задания. Осталось примерно <b>${hoursLeft} ч.</b>\n\n<a href="${link}">Открыть задание →</a>`
    );
  }

  async notifyStudentTimerWarning(telegramId: string, requestId: string) {
    const link = this.appLink(`tasks`);
    await this.send(
      telegramId,
      `⚠️ До истечения срока выполнения осталось <b>2 часа</b>\n\n<a href="${link}">Открыть задание →</a>`
    );
  }

  async notifyStudentTimerExpired(telegramId: string, requestId: string) {
    const link = this.appLink(`tasks`);
    await this.send(
      telegramId,
      `⏰ Срок выполнения задания истёк\n\n<a href="${link}">Открыть задание →</a>`
    );
  }

  // ── Personal to citizen ───────────────────────────────────────────────────

  async notifyUserApproved(telegramId: string, language: string) {
    const messages: Record<string, string> = {
      ru: "✅ Ваше обращение принято к обработке",
      uz: "✅ Murojaatingiz ko'rib chiqish uchun qabul qilindi",
      en: "✅ Your request has been accepted for processing",
    };
    await this.send(telegramId, messages[language] || messages.ru);
  }

  async notifyUserRequestTaken(telegramId: string, language: string) {
    const messages: Record<string, string> = {
      ru: "👨‍💼 Студент-консультант взял ваше обращение в работу. Ожидайте ответа.",
      uz: "👨‍💼 Talaba-konsultant murojaatingizni ko'rib chiqishga oldi. Javobni kuting.",
      en: "👨‍💼 A student consultant has taken your request. Please wait for the answer.",
    };
    await this.send(telegramId, messages[language] || messages.ru);
  }

  async notifyUserRejected(
    telegramId: string,
    language: string,
    reason: string
  ) {
    const prefixes: Record<string, string> = {
      ru: "❌ Ваше обращение отклонено.\n\nПричина:",
      uz: "❌ Murojaatingiz rad etildi.\n\nSabab:",
      en: "❌ Your request has been declined.\n\nReason:",
    };
    const prefix = prefixes[language] || prefixes.ru;
    await this.send(telegramId, `${prefix} ${reason}`);
  }

  /**
   * Sends the final answer to the citizen.
   * Automatically splits messages longer than 4096 characters (§7).
   * Sends attached files (answerFiles) after the text.
   * Sends an additional "rate this answer" message with a 1-5 star keyboard
   * at the very end. Returns that rating message_id (or null on failure /
   * if answerText is empty).
   */
  async notifyUserAnswerReady(
    telegramId: string,
    language: string,
    answerText: string | null,
    answerFiles?: { ref: string; originalName: string; source: string }[],
    requestId?: string
  ): Promise<number | null> {
    if (!answerText) return null;

    const headers: Record<string, string> = {
      ru: "✅ Ваш вопрос рассмотрен. Ответ юридической клиники:\n\n",
      uz: "✅ Savolingiz ko'rib chiqildi. Huquqiy klinika javobi:\n\n",
      en: "✅ Your question has been reviewed. Legal Clinic answer:\n\n",
    };

    const fullText = (headers[language] || headers.ru) + answerText;
    const parts = this.splitMessage(fullText);

    for (let i = 0; i < parts.length; i++) {
      await this.send(telegramId, parts[i]);
      if (i < parts.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // Send attached files one by one
    if (answerFiles?.length) {
      for (const file of answerFiles) {
        if (file.source === "web" && file.ref) {
          await this.sendDocumentToUser(
            telegramId,
            file.ref,
            file.originalName
          );
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }

    // Send rating prompt (отдельное сообщение, чтобы не засорять сам ответ)
    if (requestId) {
      await new Promise((r) => setTimeout(r, 300));
      return this.sendRatingPrompt(telegramId, language, requestId);
    }

    return null;
  }

  // ── Citizen rating keyboard ────────────────────────────────────────────

  private ratingTexts(language: string): {
    prompt: string;
    current: string;
    confirm: string;
    thanks: string;
  } {
    const table: Record<
      string,
      { prompt: string; current: string; confirm: string; thanks: string }
    > = {
      ru: {
        prompt:
          "⭐ <b>Оцените качество полученного ответа</b>\n\nОт 1 (плохо) до 5 (отлично). Выберите количество звёзд и нажмите «Подтвердить». До подтверждения оценку можно изменить.",
        current: "Ваша оценка: ",
        confirm: "✅ Подтвердить",
        thanks: "🙏 Спасибо за оценку!\n\nВаша оценка: ",
      },
      uz: {
        prompt:
          "⭐ <b>Olingan javob sifatini baholang</b>\n\n1 (yomon) dan 5 (a'lo) gacha. Yulduzlar sonini tanlang va «Tasdiqlash» tugmasini bosing. Tasdiqlashgacha bahoni o'zgartirish mumkin.",
        current: "Sizning bahoingiz: ",
        confirm: "✅ Tasdiqlash",
        thanks: "🙏 Baho uchun rahmat!\n\nSizning bahoingiz: ",
      },
      en: {
        prompt:
          "⭐ <b>Please rate the quality of the answer</b>\n\nFrom 1 (poor) to 5 (excellent). Select the number of stars and press «Confirm». You can change your rating until you confirm it.",
        current: "Your rating: ",
        confirm: "✅ Confirm",
        thanks: "🙏 Thank you for your rating!\n\nYour rating: ",
      },
    };
    return table[language] || table.ru;
  }

  private stars(n: number): string {
    // n filled + (5-n) empty
    return "⭐".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
  }

  /**
   * Inline keyboard: row of 5 star buttons (selected one marked),
   * plus a Confirm button if a selection exists.
   * selected=null → only stars, no confirm (initial state).
   */
  private buildRatingKeyboard(
    requestId: string,
    selected: number | null,
    confirmLabel: string
  ) {
    const starsRow = [1, 2, 3, 4, 5].map((n) => ({
      text: selected === n ? `⭐${n}` : `${n}`,
      callback_data: `rate:${requestId}:${n}`,
    }));
    const rows: any[] = [starsRow];
    if (selected) {
      rows.push([
        { text: confirmLabel, callback_data: `rate_confirm:${requestId}` },
      ]);
    }
    return { inline_keyboard: rows };
  }

  /** Sends the initial rating prompt (no star selected yet). */
  async sendRatingPrompt(
    telegramId: string,
    language: string,
    requestId: string
  ): Promise<number | null> {
    const t = this.ratingTexts(language);
    const kb = this.buildRatingKeyboard(requestId, null, t.confirm);
    return this.sendWithResponse(telegramId, t.prompt, kb);
  }

  /** Edits an existing rating prompt to reflect the new selection. */
  async updateRatingSelection(
    chatId: string,
    messageId: number,
    language: string,
    requestId: string,
    selected: number
  ): Promise<void> {
    if (!this.token || !chatId || !messageId) return;
    const t = this.ratingTexts(language);
    const newText = `${t.prompt}\n\n${t.current}${this.stars(selected)}`;
    const kb = this.buildRatingKeyboard(requestId, selected, t.confirm);
    try {
      const url = `${TELEGRAM_API}/bot${this.token}/editMessageText`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: newText,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: kb,
        }),
      });
    } catch (e) {
      this.logger.warn(
        `Failed to update rating selection ${messageId} in ${chatId}: ${e.message}`
      );
    }
  }

  /** Finalizes the rating message - removes keyboard, shows thanks text. */
  async finalizeRatingMessage(
    chatId: string,
    messageId: number,
    language: string,
    selected: number
  ): Promise<void> {
    if (!this.token || !chatId || !messageId) return;
    const t = this.ratingTexts(language);
    const newText = `${t.thanks}${this.stars(selected)}`;
    await this.editMessage(chatId, messageId, newText);
  }

  /** Reads a file from disk and sends it to the user via Telegram sendDocument. */
  private async sendDocumentToUser(
    chatId: string,
    filename: string,
    originalName: string
  ): Promise<void> {
    if (!this.token || !chatId) return;
    try {
      const { existsSync, readFileSync } = await import("fs");
      const { join } = await import("path");
      const filePath = join(process.cwd(), "uploads", filename);
      if (!existsSync(filePath)) {
        this.logger.warn(`sendDocumentToUser: file not found: ${filename}`);
        return;
      }

      const fileBuffer = readFileSync(filePath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("document", blob, originalName || filename);

      const res = await fetch(`${TELEGRAM_API}/bot${this.token}/sendDocument`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as any;
      if (!data.ok) {
        this.logger.error(
          `sendDocument failed for ${chatId}: [${data.error_code}] ${data.description}`
        );
      }
    } catch (e) {
      this.logger.error(`sendDocumentToUser error: ${e.message}`);
    }
  }

  async notifyUserDirectMessage(telegramId: string, text: string) {
    await this.send(telegramId, text);
  }
}
