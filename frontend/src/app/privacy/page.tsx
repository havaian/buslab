"use client";

import { useEffect, useState } from "react";

type Locale = "ru" | "uz" | "en";

const LOCALE_LABELS: Record<Locale, string> = {
  ru: "Русский",
  uz: "O'zbek",
  en: "English",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function PrivacyPage() {
  const [available, setAvailable] = useState<Record<Locale, boolean>>({
    ru: false,
    uz: false,
    en: false,
  });
  const [locale, setLocale] = useState<Locale>("ru");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/legal`)
      .then((r) => r.json())
      .then((data: Record<Locale, boolean>) => {
        setAvailable(data);
        // Pick the first available locale as default
        const first = (["ru", "uz", "en"] as Locale[]).find((l) => data[l]);
        if (first) setLocale(first);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const availableLocales = (["ru", "uz", "en"] as Locale[]).filter(
    (l) => available[l]
  );

  const fileUrl = `${API_BASE}/legal/${locale}/file`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Логотип" className="h-7 w-7" />
          <span className="font-semibold text-sm">Юридическая клиника</span>
        </div>
        {/* Language switcher */}
        {availableLocales.length > 1 && (
          <div className="flex gap-1">
            {availableLocales.map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  locale === l
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {LOCALE_LABELS[l]}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Загрузка...
          </div>
        ) : availableLocales.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Документ ещё не загружен.
          </div>
        ) : !available[locale] ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Документ на выбранном языке недоступен.
          </div>
        ) : (
          <iframe
            key={fileUrl}
            src={fileUrl}
            className="flex-1 w-full border-0"
            style={{ minHeight: "calc(100vh - 57px)" }}
            title="Политика конфиденциальности и условия использования"
          />
        )}
      </main>
    </div>
  );
}
