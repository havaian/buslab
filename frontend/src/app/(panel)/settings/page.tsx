"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { settingsApi, localesApi, legalApi } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { UniversitiesTab } from "./_components/universities-tab";

type MainTab = "texts" | "locales" | "documents" | "universities";
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

const DOC_LOCALES: { key: LocaleKey; label: string }[] = [
  { key: "ru", label: "Русский" },
  { key: "uz", label: "O'zbek" },
  { key: "en", label: "English" },
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

// ── Locale editor ─────────────────────────────────────────────────────────────

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

  if (loading)
    return <p className="text-sm text-muted-foreground py-4">Загрузка...</p>;
  if (!flat) return null;

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

// ── Documents tab ─────────────────────────────────────────────────────────────

function DocumentsTab() {
  const { toast } = useToast();
  const [available, setAvailable] = useState<Record<LocaleKey, boolean>>({
    ru: false,
    uz: false,
    en: false,
  });
  const [uploading, setUploading] = useState<LocaleKey | null>(null);
  const fileRefs = {
    ru: useRef<HTMLInputElement>(null),
    uz: useRef<HTMLInputElement>(null),
    en: useRef<HTMLInputElement>(null),
  };

  const loadInfo = useCallback(async () => {
    try {
      const data = await legalApi.info();
      setAvailable(data);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const handleUpload = async (locale: LocaleKey, file: File) => {
    setUploading(locale);
    try {
      await legalApi.upload(locale, file);
      toast(`Документ (${locale.toUpperCase()}) загружен`, "success");
      setAvailable((prev) => ({ ...prev, [locale]: true }));
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка загрузки", "error");
    } finally {
      setUploading(null);
      // reset input
      if (fileRefs[locale].current) fileRefs[locale].current.value = "";
    }
  };

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm">
            Политика и условия использования
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-2 space-y-1">
          <p className="text-xs text-muted-foreground mb-4">
            Один PDF-файл на каждый язык. Содержит оба документа — политику
            конфиденциальности и условия использования. Отображается на странице{" "}
            <a
              href="/privacy"
              target="_blank"
              className="underline hover:no-underline"
            >
              /privacy
            </a>
            .
          </p>
          {DOC_LOCALES.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center gap-3 py-2.5 border-b last:border-0"
            >
              <span className="text-sm font-medium w-24 shrink-0">{label}</span>
              <span className="text-xs text-muted-foreground flex-1">
                {available[key] ? (
                  <a
                    href={`${apiBase}/legal/${key}/file`}
                    target="_blank"
                    className="text-primary underline hover:no-underline"
                  >
                    Посмотреть файл
                  </a>
                ) : (
                  "Не загружен"
                )}
              </span>
              <input
                ref={fileRefs[key]}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(key, file);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={uploading !== null}
                onClick={() => fileRefs[key].current?.click()}
              >
                {uploading === key
                  ? "Загрузка..."
                  : available[key]
                  ? "Заменить"
                  : "Загрузить"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main settings page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState<MainTab>("texts");
  const [localeTab, setLocaleTab] = useState<LocaleKey>("ru");

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

  const MAIN_TABS: { key: MainTab; label: string }[] = [
    { key: "texts", label: "Тексты" },
    { key: "locales", label: "Локализация" },
    { key: "documents", label: "Документы" },
    { key: "universities", label: "Университеты" },
  ];

  return (
    <PageShell title="Настройки">
      {/* Main tabs */}
      <div className="flex gap-1 border-b mb-5">
        {MAIN_TABS.map(({ key, label }) => (
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

      {/* ── Тексты ─────────────────────────────────────────────────────────── */}
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

      {/* ── Локализация ─────────────────────────────────────────────────────── */}
      {mainTab === "locales" && (
        <div className="max-w-2xl">
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

      {/* ── Документы ───────────────────────────────────────────────────────── */}
      {mainTab === "documents" && <DocumentsTab />}

      {/* ── Университеты ────────────────────────────────────────────────────── */}
      {mainTab === "universities" && <UniversitiesTab />}
    </PageShell>
  );
}
