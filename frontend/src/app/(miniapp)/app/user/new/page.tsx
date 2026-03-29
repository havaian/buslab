"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X } from "lucide-react";
import { categoriesApi, type Category } from "@/lib/api";
import { MobileHeader } from "../../../_components/mobile-header";
import { useToast } from "@/components/ui/toast-provider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const MIN_LENGTH = 150;

export default function UserNewRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    categoriesApi.list().then((cats) => {
      setCategories(cats);
      if (cats.length) setCategoryId(cats[0]._id);
    });
  }, []);

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...incoming.filter((f) => !names.has(f.name))];
    });
    e.target.value = "";
  };

  const submit = async () => {
    if (!categoryId) return toast("Выберите категорию", "error");
    if (text.length < MIN_LENGTH)
      return toast(`Минимум ${MIN_LENGTH} символов`, "error");

    setSubmitting(true);
    try {
      const token = localStorage.getItem("miniapp_token");
      const form = new FormData();
      form.append("categoryId", categoryId);
      form.append("text", text);
      files.forEach((f) => form.append("files", f));

      const res = await fetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Ошибка отправки");
      }

      toast("Обращение отправлено", "success");
      router.push("/app/user");
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader title="Новое обращение" back="/app/user" />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Категория
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.names?.ru || c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Текст обращения
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Опишите вашу ситуацию подробно (минимум ${MIN_LENGTH} символов)`}
            rows={8}
            className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p
            className={`text-xs text-right ${
              text.length < MIN_LENGTH
                ? "text-muted-foreground"
                : "text-green-600"
            }`}
          >
            {text.length} / {MIN_LENGTH}
          </p>
        </div>

        {/* Files */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Файлы (необязательно)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={addFiles}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground w-full"
          >
            <Paperclip size={15} />
            Прикрепить файлы
          </button>
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <span className="text-xs truncate">{f.name}</span>
                  <button
                    onClick={() =>
                      setFiles((prev) => prev.filter((x) => x.name !== f.name))
                    }
                  >
                    <X size={14} className="text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="px-4 pb-6 pt-2">
        <button
          onClick={submit}
          disabled={submitting || text.length < MIN_LENGTH || !categoryId}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Отправка..." : "Отправить обращение"}
        </button>
      </div>
    </div>
  );
}
