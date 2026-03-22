"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { faqApi, categoriesApi, type FaqItem, type Category } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-provider";
import { useDialog } from "@/components/ui/dialog-provider";

type Lang = "ru" | "uz" | "en";
const LANGS: {
  key: Lang;
  label: string;
  placeholder: { q: string; a: string };
}[] = [
  {
    key: "ru",
    label: "Русский",
    placeholder: { q: "Текст вопроса", a: "Текст ответа" },
  },
  {
    key: "uz",
    label: "O'zbek",
    placeholder: { q: "Savol matni", a: "Javob matni" },
  },
  {
    key: "en",
    label: "English",
    placeholder: { q: "Question text", a: "Answer text" },
  },
];

type TranslationsState = Record<Lang, { question: string; answer: string }>;

const emptyTranslations = (): TranslationsState => ({
  ru: { question: "", answer: "" },
  uz: { question: "", answer: "" },
  en: { question: "", answer: "" },
});

export default function FaqPage() {
  const { toast } = useToast();
  const dialog = useDialog();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FaqItem | null>(null);
  const [activeLang, setActiveLang] = useState<Lang>("ru");
  const [fCategory, setFCategory] = useState("");
  const [translations, setTranslations] = useState<TranslationsState>(
    emptyTranslations()
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFaqs(await faqApi.list(search));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    categoriesApi.list().then(setCategories);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const getCategoryName = (id: string) =>
    categories.find((c) => c._id === id)?.names?.ru ||
    categories.find((c) => c._id === id)?.name ||
    id;

  const openCreate = () => {
    setEditTarget(null);
    setFCategory("");
    setTranslations(emptyTranslations());
    setActiveLang("ru");
    setFormOpen(true);
  };

  const openEdit = (f: FaqItem) => {
    setEditTarget(f);
    setFCategory(f.categoryId);
    setTranslations({
      ru: {
        question: f.translations?.ru?.question || f.question,
        answer: f.translations?.ru?.answer || f.answer,
      },
      uz: {
        question: f.translations?.uz?.question || "",
        answer: f.translations?.uz?.answer || "",
      },
      en: {
        question: f.translations?.en?.question || "",
        answer: f.translations?.en?.answer || "",
      },
    });
    setActiveLang("ru");
    setFormOpen(true);
  };

  const setField = (
    lang: Lang,
    field: "question" | "answer",
    value: string
  ) => {
    setTranslations((p) => ({ ...p, [lang]: { ...p[lang], [field]: value } }));
  };

  const save = async () => {
    if (
      !translations.ru.question.trim() ||
      !translations.ru.answer.trim() ||
      !fCategory
    )
      return;
    setBusy(true);
    try {
      if (editTarget) {
        await faqApi.update(editTarget._id, {
          question: translations.ru.question,
          answer: translations.ru.answer,
          categoryId: fCategory,
          translations,
        });
        toast("FAQ обновлён", "success");
      } else {
        await faqApi.create(
          fCategory,
          translations.ru.question,
          translations.ru.answer,
          translations
        );
        toast("FAQ создан", "success");
      }
      setFormOpen(false);
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: FaqItem) => {
    const ok = await dialog.confirm(
      `Удалить вопрос: «${f.translations?.ru?.question || f.question}»?`,
      { title: "Удалить FAQ?", variant: "destructive", confirmLabel: "Удалить" }
    );
    if (!ok) return;
    setBusy(true);
    try {
      await faqApi.remove(f._id);
      toast("FAQ удалён", "success");
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Group by category
  const byCat = categories
    .map((c) => ({
      cat: c,
      items: faqs.filter((f) => f.categoryId === c._id),
    }))
    .filter((g) => g.items.length > 0);
  const uncategorised = faqs.filter(
    (f) => !categories.find((c) => c._id === f.categoryId)
  );

  return (
    <PageShell
      title="FAQ"
      description={`${faqs.length} вопросов`}
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-40 text-xs"
            />
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Добавить
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : faqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет FAQ</p>
      ) : (
        <div className="space-y-4">
          {byCat.map(({ cat, items }) => (
            <Card key={cat._id} className="overflow-hidden">
              <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer bg-muted/30 border-b hover:bg-muted/50"
                onClick={() => toggle(cat._id)}
              >
                <span className="text-muted-foreground shrink-0">
                  {expanded.has(cat._id) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </span>
                <span className="font-medium text-sm">
                  {cat.names?.ru || cat.name}
                </span>
                {(cat.names?.uz || cat.names?.en) && (
                  <span className="text-xs text-muted-foreground">
                    {cat.names?.uz && `· ${cat.names.uz}`}
                    {cat.names?.en && ` · ${cat.names.en}`}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>

              {expanded.has(cat._id) && (
                <div className="divide-y">
                  {items.map((f) => (
                    <div key={f._id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-medium">
                            {f.translations?.ru?.question || f.question}
                          </p>
                          {(f.translations?.uz?.question ||
                            f.translations?.en?.question) && (
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                              {f.translations?.uz?.question && (
                                <p className="text-xs text-muted-foreground">
                                  🇺🇿 {f.translations.uz.question}
                                </p>
                              )}
                              {f.translations?.en?.question && (
                                <p className="text-xs text-muted-foreground">
                                  🇺🇸 {f.translations.en.question}
                                </p>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {f.translations?.ru?.answer || f.answer}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEdit(f)}
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-600"
                            onClick={() => remove(f)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
          {uncategorised.length > 0 && (
            <Card>
              <div className="px-4 py-2 text-xs text-muted-foreground border-b bg-muted/30">
                Без категории
              </div>
              <div className="divide-y">
                {uncategorised.map((f) => (
                  <div
                    key={f._id}
                    className="flex items-center justify-between px-4 py-3 gap-3"
                  >
                    <p className="text-sm">
                      {f.translations?.ru?.question || f.question}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(f)}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500"
                        onClick={() => remove(f)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Редактировать FAQ" : "Новый FAQ"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Category */}
            <div className="space-y-1.5">
              <Label>
                Категория <span className="text-red-500">*</span>
              </Label>
              <Select value={fCategory} onValueChange={setFCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Выбрать категорию..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.names?.ru || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lang tabs */}
            <div className="flex gap-1 border rounded-md p-1 bg-muted/30">
              {LANGS.map((l) => {
                const filled =
                  translations[l.key].question.trim() &&
                  translations[l.key].answer.trim();
                return (
                  <button
                    key={l.key}
                    onClick={() => setActiveLang(l.key)}
                    className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                      activeLang === l.key
                        ? "bg-background shadow-sm font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l.label}
                    {l.key === "ru" && !filled && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                    {l.key !== "ru" && !filled && (
                      <span className="ml-1 text-amber-500">•</span>
                    )}
                    {filled && l.key !== "ru" && (
                      <span className="ml-1 text-green-500">✓</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Question / Answer for active lang */}
            {LANGS.filter((l) => l.key === activeLang).map((l) => (
              <div key={l.key} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>
                    Вопрос
                    {l.key === "ru" && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                    {l.key !== "ru" && (
                      <span className="text-muted-foreground font-normal ml-1 text-xs">
                        (необязательно)
                      </span>
                    )}
                  </Label>
                  <Input
                    value={translations[l.key].question}
                    onChange={(e) =>
                      setField(l.key, "question", e.target.value)
                    }
                    placeholder={l.placeholder.q}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Ответ
                    {l.key === "ru" && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                    {l.key !== "ru" && (
                      <span className="text-muted-foreground font-normal ml-1 text-xs">
                        (необязательно)
                      </span>
                    )}
                  </Label>
                  <Textarea
                    value={translations[l.key].answer}
                    onChange={(e) => setField(l.key, "answer", e.target.value)}
                    placeholder={l.placeholder.a}
                    rows={5}
                  />
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={busy}
              >
                Отмена
              </Button>
              <Button
                onClick={save}
                disabled={
                  !translations.ru.question.trim() ||
                  !translations.ru.answer.trim() ||
                  !fCategory ||
                  busy
                }
              >
                {busy ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
