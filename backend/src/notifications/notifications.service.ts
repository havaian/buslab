import { Injectable, Logger } from "@nestjs/common";

// Thin wrapper around Telegram Bot API sendMessage.
// Does NOT use Telegraf — bot/ service owns the bot instance.
// This service calls the HTTP API directly so the backend can send
// notifications without coupling to the bot process.

const TELEGRAM_API = "https://api.telegram.org";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private readonly adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  private readonly studentChatId = process.env.TELEGRAM_STUDENT_CHAT_ID;
  private readonly webPanelUrl = process.env.WEB_PANEL_URL || "";

  private async send(chatId: string, text: string): Promise<void> {
    if (!this.token || !chatId) return;
    try {
      const url = `${TELEGRAM_API}/bot${this.token}/sendMessage`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
    } catch (e) {
      this.logger.error(
        `Failed to send Telegram message to ${chatId}: ${e.message}`
      );
    }
  }

  // ── Admin chat ────────────────────────────────────────────────────────────

  async notifyAdminNewRequest(
    requestId: string,
    category: string,
    shortText: string
  ) {
    const link = `${this.webPanelUrl}/requests/${requestId}`;
    await this.send(
      this.adminChatId,
      `📩 <b>Новое обращение</b>\nКатегория: ${category}\n${shortText}\n\n<a href="${link}">Открыть в панели →</a>`
    );
  }

  async notifyAdminAnswerSubmitted(
    requestId: string,
    studentName: string,
    category: string
  ) {
    const link = `${this.webPanelUrl}/requests/${requestId}`;
    await this.send(
      this.adminChatId,
      `✅ <b>Студент отправил ответ</b>\nСтудент: ${studentName}\nКатегория: ${category}\n\n<a href="${link}">Проверить →</a>`
    );
  }

  async notifyAdminTimerExpired(requestId: string, studentName: string) {
    const link = `${this.webPanelUrl}/requests/${requestId}`;
    await this.send(
      this.adminChatId,
      `⏰ <b>Таймер истёк</b>\nСтудент: ${studentName} не уложился в срок\n\n<a href="${link}">Открыть обращение →</a>`
    );
  }

  async notifyAdminStudentDeclined(requestId: string, studentName: string) {
    const link = `${this.webPanelUrl}/requests/${requestId}`;
    await this.send(
      this.adminChatId,
      `↩️ <b>Студент отказался от обращения</b>\nСтудент: ${studentName}\n\n<a href="${link}">Открыть обращение →</a>`
    );
  }

  // ── Student chat ──────────────────────────────────────────────────────────

  async notifyStudentChatApproved(
    requestId: string,
    category: string,
    shortText: string
  ) {
    const link = `${this.webPanelUrl}/requests/${requestId}`;
    await this.send(
      this.studentChatId,
      `📋 <b>Новое обращение доступно</b>\nКатегория: ${category}\n${shortText}\n\n<a href="${link}">Взять в работу →</a>`
    );
  }

  async notifyStudentChatReturned(requestId: string) {
    const link = `${this.webPanelUrl}/requests/${requestId}`;
    await this.send(
      this.studentChatId,
      `🔄 Обращение возвращено в очередь\n\n<a href="${link}">Открыть →</a>`
    );
  }

  // ── Personal to student ───────────────────────────────────────────────────

  async notifyStudentAssigned(
    telegramId: string,
    requestId: string,
    shortText: string
  ) {
    const link = `${this.webPanelUrl}/tasks`;
    await this.send(
      telegramId,
      `📌 <b>Вам назначено обращение</b>\n${shortText}\n\n<a href="${link}">Открыть задание →</a>`
    );
  }

  async notifyStudentAnswerApproved(telegramId: string, requestId: string) {
    const link = `${this.webPanelUrl}/history`;
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
    const link = `${this.webPanelUrl}/tasks`;
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

  async notifyStudentTimerWarning(telegramId: string, requestId: string) {
    const link = `${this.webPanelUrl}/tasks`;
    await this.send(
      telegramId,
      `⚠️ До истечения срока выполнения осталось <b>2 часа</b>\n\n<a href="${link}">Открыть задание →</a>`
    );
  }

  async notifyStudentTimerExpired(telegramId: string, requestId: string) {
    const link = `${this.webPanelUrl}/tasks`;
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

  async notifyUserRejected(
    telegramId: string,
    language: string,
    reason: string
  ) {
    const prefixes: Record<string, string> = {
      ru: "❌ Ваше обращение отклонено",
      uz: "❌ Murojaatingiz rad etildi",
      en: "❌ Your request has been rejected",
    };
    const prefix = prefixes[language] || prefixes.ru;
    await this.send(telegramId, `${prefix}\n\n${reason}`);
  }

  async notifyUserAnswerReady(
    telegramId: string,
    language: string,
    answer: string
  ) {
    const prefixes: Record<string, string> = {
      ru: "📨 Ваш ответ готов:",
      uz: "📨 Javobingiz tayyor:",
      en: "📨 Your answer is ready:",
    };
    const prefix = prefixes[language] || prefixes.ru;
    // Split long messages at paragraph boundaries (Telegram 4096 char limit)
    const parts = splitMessage(`${prefix}\n\n${answer}`);
    for (const part of parts) {
      await this.send(telegramId, part);
      // Small delay between parts to preserve order
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  async notifyUserDirectMessage(telegramId: string, text: string) {
    await this.send(telegramId, text);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const MAX_LEN = 4096;

function splitMessage(text: string): string[] {
  if (text.length <= MAX_LEN) return [text];
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_LEN) {
    let cutAt = remaining.lastIndexOf("\n\n", MAX_LEN);
    if (cutAt <= 0) cutAt = remaining.lastIndexOf("\n", MAX_LEN);
    if (cutAt <= 0) cutAt = remaining.lastIndexOf(" ", MAX_LEN);
    if (cutAt <= 0) cutAt = MAX_LEN; // hard cut — last resort
    parts.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining.length > 0) parts.push(remaining);
  return parts;
}
