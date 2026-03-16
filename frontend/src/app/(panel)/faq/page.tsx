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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";

export default function FaqPage() {
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FaqItem | null>(null);
  const [fQuestion, setFQuestion] = useState("");
  const [fAnswer, setFAnswer] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FaqItem | null>(null);

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

  const openCreate = () => {
    setEditTarget(null);
    setFQuestion("");
    setFAnswer("");
    setFCategory("");
    setFormOpen(true);
  };
  const openEdit = (f: FaqItem) => {
    setEditTarget(f);
    setFQuestion(f.question);
    setFAnswer(f.answer);
    setFCategory(f.categoryId);
    setFormOpen(true);
  };

  const save = async () => {
    if (!fQuestion.trim() || !fAnswer.trim() || !fCategory) return;
    setBusy(true);
    try {
      if (editTarget) {
        await faqApi.update(editTarget._id, {
          question: fQuestion,
          answer: fAnswer,
          categoryId: fCategory,
        });
        toast("FAQ обновлён", "success");
      } else {
        await faqApi.create(fCategory, fQuestion, fAnswer);
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

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await faqApi.remove(deleteTarget._id);
      toast("FAQ удалён", "success");
      setDeleteTarget(null);
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Group by category
  const catMap = new Map(categories.map((c) => [c._id, c.name]));
  const grouped = faqs.reduce<Record<string, FaqItem[]>>((acc, f) => {
    const key = f.categoryId || "unknown";
    acc[key] = acc[key] || [];
    acc[key].push(f);
    return acc;
  }, {});

  return (
    <PageShell
      title="FAQ"
      description={`${faqs.length} вопросов`}
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Добавить
        </Button>
      }
    >
      <div className="relative max-w-xs mb-4">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : faqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ничего не найдено</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([catId, items]) => (
            <Card key={catId}>
              <div className="px-4 py-3 border-b bg-muted/30">
                <span className="text-sm font-semibold">
                  {catMap.get(catId) || "Без категории"}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <CardContent className="p-0 divide-y">
                {items.map((f) => (
                  <div key={f._id}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20"
                      onClick={() => toggleExpand(f._id)}
                    >
                      <span className="text-muted-foreground shrink-0">
                        {expanded.has(f._id) ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </span>
                      <span className="flex-1 text-sm font-medium">
                        {f.question}
                      </span>
                      <div
                        className="flex gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(f)}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setDeleteTarget(f)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                    {expanded.has(f._id) && (
                      <div className="px-10 pb-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {f.answer}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Редактировать FAQ" : "Новый FAQ"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label>Категория</Label>
              <Select value={fCategory} onValueChange={setFCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Выбрать категорию..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Вопрос</Label>
              <Input
                value={fQuestion}
                onChange={(e) => setFQuestion(e.target.value)}
                placeholder="Текст вопроса"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ответ</Label>
              <Textarea
                value={fAnswer}
                onChange={(e) => setFAnswer(e.target.value)}
                placeholder="Текст ответа"
                rows={6}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
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
                  !fQuestion.trim() || !fAnswer.trim() || !fCategory || busy
                }
              >
                {busy ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Удалить FAQ?"
        description={deleteTarget?.question}
        variant="destructive"
        confirmLabel="Удалить"
        loading={busy}
        onConfirm={remove}
      />
    </PageShell>
  );
}
