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

export default function CategoriesPage() {
  const { toast } = useToast();
  const dialog = useDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [hashtag, setHashtag] = useState("");

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
    setName("");
    setHashtag("");
    setFormOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditTarget(c);
    setName(c.name);
    setHashtag(c.hashtag);
    setFormOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !hashtag.trim()) return;
    setBusy(true);
    try {
      if (editTarget) {
        await categoriesApi.update(editTarget._id, name, hashtag);
        toast("Категория обновлена", "success");
      } else {
        await categoriesApi.create(name, hashtag);
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
      `Удалить категорию «${c.name}»? Нельзя удалить если используется в активных обращениях.`,
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
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} />
          Добавить
        </Button>
      }
    >
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Название</th>
                <th className="px-4 py-2.5 text-left font-medium">Хэштег</th>
                <th className="px-4 py-2.5 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Загрузка...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Нет категорий
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c._id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
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
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Редактировать категорию" : "Новая категория"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название категории"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Хэштег</Label>
              <Input
                value={hashtag}
                onChange={(e) => setHashtag(e.target.value)}
                placeholder="например: grazhdanskoe_pravo"
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
                disabled={!name.trim() || !hashtag.trim() || busy}
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
