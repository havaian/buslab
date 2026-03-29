"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Paperclip, X, ClipboardList, History, User } from "lucide-react";
import {
  requestsApi,
  adminUsersApi,
  type Request,
  type StudentStats,
} from "@/lib/api";
import { BottomNav } from "../../_components/bottom-nav";
import { MobileHeader } from "../../_components/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timer } from "@/components/shared/timer";
import { FileList } from "@/components/shared/file-list";
import { useToast } from "@/components/ui/toast-provider";
import { getCategoryName } from "@/lib/utils";
import { Suspense } from "react";

const NAV = [
  { href: "/app/student", label: "Задание", icon: ClipboardList },
  { href: "/app/student/history", label: "История", icon: History },
  { href: "/app/student/profile", label: "Профиль", icon: User },
];

function StudentTasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeRequest, setActiveRequest] = useState<Request | null>(null);
  const [available, setAvailable] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [declineConfirm, setDeclineConfirm] = useState(false);

  const load = async () => {
    try {
      const [history, avail] = await Promise.all([
        requestsApi.myHistory(),
        requestsApi.available(),
      ]);
      const active =
        history.find(
          (r) => r.status === "assigned" || r.status === "answered"
        ) ?? null;
      setActiveRequest(active);
      setAvailable(avail);
      if (active) setAnswer(active.answerText || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Auto-take from ?take= param
  useEffect(() => {
    const takeId = searchParams.get("take");
    if (!takeId || activeRequest || loading) return;
    requestsApi
      .take(takeId)
      .then(() => load())
      .catch((e) => toast((e as Error).message, "error"));
  }, [searchParams, activeRequest, loading]);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(msg, "success");
      await load();
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setBusy(false);
    }
  };

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const inc = Array.from(e.target.files);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...inc.filter((f) => !names.has(f.name))];
    });
    e.target.value = "";
  };

  const submitAnswer = () => {
    if (!activeRequest || !answer.trim()) return;
    const fl = files.length
      ? (() => {
          const dt = new DataTransfer();
          files.forEach((f) => dt.items.add(f));
          return dt.files;
        })()
      : undefined;
    run(
      () => requestsApi.submitAnswer(activeRequest._id, answer, fl),
      "Ответ отправлен на проверку"
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-16">
        Загрузка...
      </div>
    );
  }

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

  return (
    <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">
      {/* Active assignment */}
      {activeRequest ? (
        <div className="rounded-xl border bg-card space-y-3 overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold">Текущее задание</p>
              <p className="text-xs text-muted-foreground">
                {getCategoryName(activeRequest.categoryId)}
              </p>
            </div>
            <StatusBadge status={activeRequest.status} />
          </div>

          <div className="px-4 space-y-3 pb-3">
            {/* Timer */}
            {activeRequest.status === "assigned" &&
              activeRequest.timerDeadline && (
                <Timer deadline={activeRequest.timerDeadline} />
              )}

            {/* Request text */}
            <p className="text-sm whitespace-pre-wrap">{activeRequest.text}</p>

            {/* Request files */}
            {activeRequest.requestFiles?.length > 0 && (
              <FileList files={activeRequest.requestFiles} />
            )}

            {/* Admin comment on rejection */}
            {activeRequest.adminComment && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                <p className="text-xs font-medium text-orange-700 mb-1">
                  Комментарий администратора
                </p>
                <p className="text-sm text-orange-800">
                  {activeRequest.adminComment}
                </p>
              </div>
            )}

            {/* Answer form */}
            {activeRequest.status === "assigned" && (
              <>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Напишите ваш ответ..."
                  rows={5}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,.docx,.doc"
                  className="hidden"
                  onChange={addFiles}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Paperclip size={13} /> Прикрепить файлы (PDF, Word)
                </button>
                {files.length > 0 && (
                  <div className="space-y-1">
                    {files.map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1"
                      >
                        <span className="text-xs truncate">{f.name}</span>
                        <button
                          onClick={() =>
                            setFiles((p) => p.filter((x) => x.name !== f.name))
                          }
                        >
                          <X size={12} className="text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={submitAnswer}
                    disabled={busy || !answer.trim()}
                    className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Отправить ответ
                  </button>
                  <button
                    onClick={() => setDeclineConfirm(true)}
                    disabled={busy}
                    className="rounded-lg border px-3 py-2.5 text-sm text-destructive"
                  >
                    Отказаться
                  </button>
                </div>
              </>
            )}

            {/* Submitted answer preview */}
            {activeRequest.status === "answered" &&
              activeRequest.answerText && (
                <div className="rounded-lg bg-muted/30 px-3 py-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ваш ответ (на проверке)
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {activeRequest.answerText}
                  </p>
                </div>
              )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card px-4 py-6 text-center space-y-1">
          <p className="text-sm font-medium">Нет активного задания</p>
          <p className="text-xs text-muted-foreground">
            Возьмите одно из доступных обращений ниже
          </p>
        </div>
      )}

      {/* Available requests */}
      {!activeRequest && available.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground px-1">
            Доступные обращения ({available.length})
          </p>
          {available.map((r) => (
            <div
              key={r._id}
              className="rounded-xl border bg-card px-4 py-3 space-y-2"
            >
              <p className="text-xs text-muted-foreground">
                {getCategoryName(r.categoryId)}
              </p>
              <p className="text-sm line-clamp-3">{r.text}</p>
              <button
                disabled={busy}
                onClick={() =>
                  run(() => requestsApi.take(r._id), "Задание взято")
                }
                className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Взять в работу
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Decline confirm */}
      {declineConfirm && activeRequest && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-background px-4 py-6 space-y-3">
            <p className="text-sm font-semibold text-center">
              Отказаться от задания?
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Обращение вернётся в очередь
            </p>
            <button
              onClick={() => {
                setDeclineConfirm(false);
                run(
                  () => requestsApi.decline(activeRequest._id),
                  "Отказ принят"
                );
              }}
              className="w-full rounded-xl bg-destructive py-3 text-sm font-medium text-destructive-foreground"
            >
              Да, отказаться
            </button>
            <button
              onClick={() => setDeclineConfirm(false)}
              className="w-full rounded-xl border py-3 text-sm font-medium"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentTasksPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      <MobileHeader title="Задания" />
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Загрузка...
          </div>
        }
      >
        <StudentTasksContent />
      </Suspense>
      <BottomNav items={NAV} />
    </div>
  );
}
