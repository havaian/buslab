// ── Callback data prefixes ─────────────────────────────────────────────────
// Keep in sync with bot.update.ts callbackQuery() matchers.

export const CB = {
  // Onboarding
  ONBOARD_LANG: "onboard_lang", // onboard_lang:<locale>
  OFFER_ACCEPT: "offer:accept",
  OFFER_DECLINE: "offer:decline",

  // Language change (from main menu)
  LANG: "lang", // lang:<locale>

  // FAQ
  FAQ_CAT: "faq_cat", // faq_cat:<categoryId>
  FAQ_ITEM: "faq_item", // faq_item:<faqId>

  // Admin - request moderation
  APPROVE_REQUEST: "approve_request", // approve_request:<requestId>
  DECLINE_REQUEST: "decline_request", // decline_request:<requestId>

  // Admin - answer moderation
  APPROVE_ANSWER: "approve_answer", // approve_answer:<requestId>
  DECLINE_ANSWER: "decline_answer", // decline_answer:<requestId>
} as const;

// Regex builders - used in bot.update.ts bot.callbackQuery() calls
export const CBRegex = {
  ONBOARD_LANG: /^onboard_lang:(.+)$/,
  LANG: /^lang:(.+)$/,
  FAQ_CAT: /^faq_cat:(.+)$/,
  FAQ_ITEM: /^faq_item:(.+)$/,
  APPROVE_REQUEST: /^approve_request:(.+)$/,
  DECLINE_REQUEST: /^decline_request:(.+)$/,
  APPROVE_ANSWER: /^approve_answer:(.+)$/,
  DECLINE_ANSWER: /^decline_answer:(.+)$/,
} as const;

// ── Supported locales ──────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ["ru", "uz", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "ru";

// ── Timer ─────────────────────────────────────────────────────────────────

export const TIMER_DURATION_MS = 12 * 60 * 60 * 1000;

// ── Request constraints ────────────────────────────────────────────────────

export const REQUEST_MIN_LENGTH = 150;
export const STUDENT_CHAT_PREVIEW_LENGTH = 100;

// ── Universities & faculties ───────────────────────────────────────────────

export const UNIVERSITIES = [
  { id: "tsul", name: { ru: "ТГЮУ", uz: "TDYU", en: "TSUL" } },
  { id: "uwed", name: { ru: "УМЭД", uz: "XHIMU", en: "UWED" } },
  { id: "wiut", name: { ru: "МУИТ", uz: "WIUT", en: "WIUT" } },
  { id: "other", name: { ru: "Другой", uz: "Boshqa", en: "Other" } },
] as const;

export const TSUL_FACULTIES = [
  {
    id: "public_law",
    name: { ru: "Публичное право", uz: "Ommaviy huquq", en: "Public law" },
  },
  {
    id: "business_law",
    name: {
      ru: "Бизнес-право и судебная защита",
      uz: "Biznes huquqi va sud himoyasi",
      en: "Business law and judicial protection",
    },
  },
  {
    id: "criminal_justice",
    name: {
      ru: "Уголовное правосудие",
      uz: "Jinoiy odil sudlov",
      en: "Criminal justice",
    },
  },
  {
    id: "international_law",
    name: {
      ru: "Международное право и сравнительное правоведение",
      uz: "Xalqaro huquq va qiyosiy huquqshunoslik",
      en: "International law and comparative law",
    },
  },
  {
    id: "interdisciplinary",
    name: {
      ru: "Междисциплинарное изучение права",
      uz: "Huquqni sohalararo o'rganish",
      en: "Interdisciplinary study of law",
    },
  },
] as const;

export const CB_UNI = "uni";
export const CB_FAC = "fac";
export const CBRegex_UNI = /^uni:(.+)$/;
export const CBRegex_FAC = /^fac:(.+)$/;