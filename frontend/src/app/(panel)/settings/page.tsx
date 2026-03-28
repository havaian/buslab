"use client";

import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";

type Tab = "texts";

const LOCALES = [
  { key: "ru", label: "Русский" },
  { key: "uz", label: "O'zbek" },
  { key: "en", label: "English" },
] as const;

export default function SettingsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("texts");

  // Standard rejection text state per locale
  const [rejectionTexts, setRejectionTexts] = useState<Record<string, string>>({
    ru: "",
    uz: "",
    en: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi
      .get("standard_rejection_text")
      .then((data) => setRejectionTexts((prev) => ({ ...prev, ...data })))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.set("standard_rejection_text", rejectionTexts);
      toast("Сохранено", "success");
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка при сохранении", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="Настройки">
      {/* Tabs */}
      <div className="flex gap-1 border-b mb-5">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "texts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("texts")}
        >
          Тексты
        </button>
      </div>

      {tab === "texts" && (
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
              {loading ? (
                <p className="text-sm text-muted-foreground">Загрузка...</p>
              ) : (
                <>
                  {LOCALES.map(({ key, label }) => (
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
                    onClick={save}
                    disabled={saving}
                    className="mt-1"
                  >
                    {saving ? "Сохранение..." : "Сохранить"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
