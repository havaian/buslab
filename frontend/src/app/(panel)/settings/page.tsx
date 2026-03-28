"use client";

import { useEffect, useState, useCallback } from "react";
import { settingsApi, localesApi } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";

type MainTab = "texts" | "locales";
type LocaleKey = "ru" | "uz" | "en";

const REJECTION_LOCALES: { key: LocaleKey; label: string }[] = [
  { key: "ru", label: "Русский" },
  { key: "uz", label: "O'zbek" },
  { key: "en", label: "English" },
];

const LOCALE_TABS: { key: LocaleKey; label: string }[] = [
  { key: "ru", label: "RU — Русский" },
  { key: "uz", label: "UZ — O'zbek" },
  { key: "en", label: "EN — English" },
];

// ── JSON flatten / unflatten ─────────────────────────────────────────────────

function flatten(
  obj: Record<string, any>,
  prefix = ""
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      result[key] = v;
    } else if (typeof v === "object" && v !== null) {
      Object.assign(result, flatten(v, key));
    }
  }
  return result;
}

function unflatten(flat: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [dotKey, value] of Object.entries(flat)) {
    const parts = dotKey.split(".");
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return result;
}

// ── Section label map ─────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  commands: "Команды",
  buttons: "Кнопки",
  onboarding: "Онбординг",
  errors: "Ошибки",
  success: "Успех",
  statuses: "Статусы",
  prompts: "Подсказки",
  language: "Язык",
  lists: "Списки",
  help: "Помощь",
};

// ── Locale editor component ───────────────────────────────────────────────────

function LocaleEditor({ locale }: { locale: LocaleKey }) {
  const { toast } = useToast();
  const [flat, setFlat] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await localesApi.get(locale);
      setFlat(flatten(data));
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка загрузки", "error");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!flat) return;
    setSaving(true);
    try {
      await localesApi.set(locale, unflatten(flat));
      toast("Сохранено", "success");
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка при сохранении", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Загрузка...</p>;
  }

  if (!flat) return null;

  // Group flat keys by first segment
  const groups: Record<string, string[]> = {};
  for (const key of Object.keys(flat)) {
    const section = key.split(".")[0];
    if (!groups[section]) groups[section] = [];
    groups[section].push(key);
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([section, keys]) => (
        <Card key={section}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm">
              {SECTION_LABELS[section] ?? section}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2 space-y-3">
            {keys.map((key) => {
              const value = flat[key] ?? "";
              const isMultiline = value.includes("\n") || value.length > 120;
              return (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-mono text-muted-foreground select-all">
                    {key}
                  </label>
                  <Textarea
                    rows={
                      isMultiline
                        ? Math.min(8, value.split("\n").length + 1)
                        : 2
                    }
                    value={value}
                    onChange={(e) =>
                      setFlat((prev) =>
                        prev ? { ...prev, [key]: e.target.value } : prev
                      )
                    }
                    className="text-sm resize-y font-sans"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Button size="sm" onClick={save} disabled={saving} className="mt-2">
        {saving ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
}

// ── Main settings page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState<MainTab>("texts");
  const [localeTab, setLocaleTab] = useState<LocaleKey>("ru");

  // Standard rejection text
  const [rejectionTexts, setRejectionTexts] = useState<Record<string, string>>({
    ru: "",
    uz: "",
    en: "",
  });
  const [loadingTexts, setLoadingTexts] = useState(true);
  const [savingTexts, setSavingTexts] = useState(false);

  useEffect(() => {
    settingsApi
      .get("standard_rejection_text")
      .then((data) => setRejectionTexts((prev) => ({ ...prev, ...data })))
      .finally(() => setLoadingTexts(false));
  }, []);

  const saveTexts = async () => {
    setSavingTexts(true);
    try {
      await settingsApi.set("standard_rejection_text", rejectionTexts);
      toast("Сохранено", "success");
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка при сохранении", "error");
    } finally {
      setSavingTexts(false);
    }
  };

  return (
    <PageShell title="Настройки">
      {/* Main tabs */}
      <div className="flex gap-1 border-b mb-5">
        {(
          [
            { key: "texts", label: "Тексты" },
            { key: "locales", label: "Локализация" },
          ] as { key: MainTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mainTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMainTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Тексты tab ─────────────────────────────────────────────────── */}
      {mainTab === "texts" && (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm">
                Стандартный текст отказа
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-2 space-y-4">
              <p className="text-xs text-muted-foreground">
                Используется при нажатии «Стандартный отказ» на странице
                обращения. Текст отправляется на языке пользователя.
              </p>
              {loadingTexts ? (
                <p className="text-sm text-muted-foreground">Загрузка...</p>
              ) : (
                <>
                  {REJECTION_LOCALES.map(({ key, label }) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {label}
                      </label>
                      <Textarea
                        rows={3}
                        value={rejectionTexts[key] ?? ""}
                        onChange={(e) =>
                          setRejectionTexts((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder={`Текст на ${label}...`}
                        className="text-sm resize-none"
                      />
                    </div>
                  ))}
                  <Button
                    size="sm"
                    onClick={saveTexts}
                    disabled={savingTexts}
                    className="mt-1"
                  >
                    {savingTexts ? "Сохранение..." : "Сохранить"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Локализация tab ─────────────────────────────────────────────── */}
      {mainTab === "locales" && (
        <div className="max-w-2xl">
          {/* Locale sub-tabs */}
          <div className="flex gap-1 border-b mb-4">
            {LOCALE_TABS.map(({ key, label }) => (
              <button
                key={key}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  localeTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setLocaleTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <LocaleEditor key={localeTab} locale={localeTab} />
        </div>
      )}
    </PageShell>
  );
}
