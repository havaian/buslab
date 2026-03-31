"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { categoriesApi, type Category } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-provider";
import { useDialog } from "@/components/ui/dialog-provider";

type Lang = "ru" | "uz" | "en";
const LANGS: { key: Lang; label: string }[] = [
  { key: "ru", label: "Русский" },
  { key: "uz", label: "O'zbek" },
  { key: "en", label: "English" },
];

export default function CategoriesPage() {
  const { toast } = useToast();
  const dialog = useDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [activeLang, setActiveLang] = useState<Lang>("ru");

  const [hashtag, setHashtag] = useState("");
  const [names, setNames] = useState({ ru: "", uz: "", en: "" });

  const load = async () => {
    setLoading(true);
    try {
      setCategories(await categoriesApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setHashtag("");
    setNames({ ru: "", uz: "", en: "" });
    setActiveLang("ru");
    setFormOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditTarget(c);
    setHashtag(c.hashtag);
    setNames({
      ru: c.names?.ru || c.name || "",
      uz: c.names?.uz || "",
      en: c.names?.en || "",
    });
    setActiveLang("ru");
    setFormOpen(true);
  };

  const save = async () => {
    if (!names.ru.trim() || !hashtag.trim()) return;
    setBusy(true);
    try {
      const payload = {
        name: names.ru,
        hashtag,
        names: { ru: names.ru, uz: names.uz, en: names.en },
      };
      if (editTarget) {
        await categoriesApi.update(editTarget._id, payload);
        toast("Категория обновлена", "success");
      } else {
        await categoriesApi.create(payload);
        toast("Категория создана", "success");
      }
      setFormOpen(false);
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Category) => {
    const ok = await dialog.confirm(
      `Удалить категорию «${
        c.names?.ru || c.name
      }»? Нельзя удалить если используется в активных обращениях.`,
      {
        title: "Удалить категорию?",
        variant: "destructive",
        confirmLabel: "Удалить",
      }
    );
    if (!ok) return;
    setBusy(true);
    try {
      await categoriesApi.remove(c._id);
      toast("Категория удалена", "success");
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title="Категории"
      description={`${categories.length} категорий`}
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} /> Добавить
        </Button>
      }
    >
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">
                    Название (RU)
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">
                    O'zbek
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">
                    English
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">
                    Хэштег
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Загрузка...
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Нет категорий
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c._id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {c.names?.ru || c.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {c.names?.uz || (
                          <span className="text-muted-foreground/40 italic text-xs">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {c.names?.en || (
                          <span className="text-muted-foreground/40 italic text-xs">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                        #{c.hashtag}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => remove(c)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Редактировать категорию" : "Новая категория"}
            </DialogTitle>
          </DialogHeader>

          {/* Lang tabs */}
          <div className="flex gap-1 border rounded-md p-1 bg-muted/30">
            {LANGS.map((l) => (
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
                {l.key !== "ru" && !names[l.key] && (
                  <span className="ml-1 text-amber-500">•</span>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>
                Название{" "}
                <span className="text-muted-foreground font-normal">
                  ({LANGS.find((l) => l.key === activeLang)?.label})
                  {activeLang === "ru" && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </span>
              </Label>
              <Input
                value={names[activeLang]}
                onChange={(e) =>
                  setNames((p) => ({ ...p, [activeLang]: e.target.value }))
                }
                placeholder={
                  activeLang === "ru"
                    ? "Название на русском"
                    : activeLang === "uz"
                    ? "O'zbekcha nomi"
                    : "Name in English"
                }
              />
              {activeLang !== "ru" && (
                <p className="text-xs text-muted-foreground">
                  Если оставить пустым - будет использоваться русское название
                </p>
              )}
            </div>

            {/* Hashtag - always visible */}
            <div className="space-y-1.5">
              <Label>
                Хэштег <span className="text-red-500">*</span>
              </Label>
              <Input
                value={hashtag}
                onChange={(e) =>
                  setHashtag(e.target.value.replace(/\s/g, "_").toLowerCase())
                }
                placeholder="grazhdanskoe_pravo"
              />
            </div>

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
                disabled={!names.ru.trim() || !hashtag.trim() || busy}
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
