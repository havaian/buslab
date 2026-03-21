"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Paperclip,
  X,
  Send,
  AlertCircle,
} from "lucide-react";
import {
  requestsApi,
  adminUsersApi,
  type Request,
  type StudentStats,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Timer } from "@/components/shared/timer";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileList } from "@/components/shared/file-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate, getCategoryName } from "@/lib/utils";

// ── Inner component (needs useSearchParams → must be inside Suspense) ─────

function TasksPageContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeRequest, setActiveRequest] = useState<Request | null>(null);
  const [available, setAvailable] = useState<Request[]>([]);
  const [myStats, setMyStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Answer form state
  const [answer, setAnswer] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirm dialog for decline
  const [declineConfirm, setDeclineConfirm] = useState(false);

  // Ref to scroll to active task after ?take= auto-take
  const activeCardRef = useRef<HTMLDivElement>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [history, avail, stats] = await Promise.all([
        requestsApi.myHistory(),
        requestsApi.available(),
        adminUsersApi.studentStats(user.id),
      ]);
      const active =
        history.find(
          (r) => r.status === "assigned" || r.status === "answered"
        ) ?? null;
      setActiveRequest(active);
      // Reset answer form when active request changes
      if (!active || active._id !== activeRequest?._id) {
        setAnswer("");
        setFiles([]);
      }
      setAvailable(avail);
      setMyStats(stats);
    } finally {
      setLoading(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ?take=<id> auto-take from Telegram link ──────────────────────────────

  useEffect(() => {
    const takeId = searchParams.get("take");
    if (!takeId || !user) return;

    // Remove the param from URL immediately so refresh doesn't re-trigger
    router.replace("/tasks", { scroll: false });

    const doTake = async () => {
      try {
        await requestsApi.take(takeId);
        toast("Обращение взято в работу", "success");
        await load();
        // Scroll to active task card
        setTimeout(
          () => activeCardRef.current?.scrollIntoView({ behavior: "smooth" }),
          100
        );
      } catch (e: unknown) {
        toast((e as Error).message || "Не удалось взять обращение", "error");
        await load();
      }
    };

    doTake();
  }, [searchParams, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(successMsg, "success");
      await load();
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleTake = (id: string) =>
    run(() => requestsApi.take(id), "Обращение взято в работу");

  const handleDecline = () =>
    run(
      () => requestsApi.decline(activeRequest!._id),
      "Обращение возвращено в очередь"
    );

  const handleSubmit = () => {
    if (!activeRequest || !answer.trim()) return;
    const fileList = files.length > 0 ? filesToFileList(files) : undefined;
    run(
      () => requestsApi.submitAnswer(activeRequest._id, answer, fileList),
      "Ответ отправлен на проверку"
    );
  };

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...incoming.filter((f) => !names.has(f.name))];
    });
    // Reset input so same file can be re-added after removal
    e.target.value = "";
  };

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  if (loading) {
    return (
      <PageShell title="Задания">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  return (
    <PageShell title="Задания">
      {/* ── Mini stats ──────────────────────────────────────────────────── */}
      {myStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          {(
            [
              ["Одобрено", myStats.approved, "text-green-600"],
              ["Отклонено", myStats.rejected, "text-red-500"],
              ["Всего ответов", myStats.submitted, "text-blue-600"],
              [
                "Рейтинг",
                myStats.rating !== null ? `${myStats.rating}%` : "—",
                "text-primary",
              ],
            ] as [string, string | number, string][]
          ).map(([label, value, color]) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* ── Left: active task (wider) ──────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4" ref={activeCardRef}>
          <h2 className="text-sm font-semibold">Текущее задание</h2>

          {/* No active task */}
          {!activeRequest && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <ClipboardList size={36} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Нет активного задания
                </p>
                <p className="text-xs text-muted-foreground">
                  Выберите обращение из списка справа
                </p>
              </CardContent>
            </Card>
          )}

          {/* Active: assigned — work in progress */}
          {activeRequest?.status === "assigned" && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={activeRequest.status} />
                    <span className="text-xs text-muted-foreground">
                      {getCategoryName(activeRequest.categoryId)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDate(activeRequest.createdAt)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {activeRequest.text}
                  </p>
                  {/* Attached files from citizen */}
                  <FileList files={(activeRequest as any).files} />
                </CardContent>
              </Card>

              {/* Timer */}
              {activeRequest.timerDeadline && (
                <Card>
                  <CardContent className="pt-4 pb-4 flex items-center gap-4">
                    <Clock
                      size={16}
                      className="text-muted-foreground shrink-0"
                    />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Дедлайн
                      </p>
                      <Timer deadline={activeRequest.timerDeadline} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Admin comment (after answer was rejected) */}
              {activeRequest.adminComment && (
                <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  <p className="font-medium mb-1 flex items-center gap-1.5">
                    <AlertCircle size={13} />
                    Комментарий администратора
                  </p>
                  <p className="text-xs leading-relaxed">
                    {activeRequest.adminComment}
                  </p>
                </div>
              )}

              {/* Answer form */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Ваш ответ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Введите юридический ответ..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={8}
                    className="text-sm resize-y"
                  />

                  {/* File attachments */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={addFiles}
                    />
                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {files.map((f) => (
                          <div
                            key={f.name}
                            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs max-w-52"
                          >
                            <Paperclip
                              size={11}
                              className="shrink-0 text-muted-foreground"
                            />
                            <span className="truncate">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => removeFile(f.name)}
                              className="shrink-0 text-muted-foreground hover:text-foreground ml-0.5"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs"
                    >
                      <Paperclip size={13} />
                      Прикрепить файлы
                    </Button>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      className="flex-1"
                      size="sm"
                      disabled={busy || !answer.trim()}
                      onClick={handleSubmit}
                    >
                      <Send size={13} />
                      Отправить на проверку
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => setDeclineConfirm(true)}
                    >
                      <XCircle size={13} />
                      Отказаться
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Active: answered — read-only, waiting for review */}
          {activeRequest?.status === "answered" && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={activeRequest.status} />
                    <span className="text-xs text-muted-foreground">
                      {getCategoryName(activeRequest.categoryId)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDate(activeRequest.createdAt)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {activeRequest.text}
                  </p>
                  <FileList files={(activeRequest as any).files} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle size={14} className="text-orange-500" />
                    Ответ отправлен — ожидает проверки
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
                    {activeRequest.answerText}
                  </p>
                  <FileList files={(activeRequest as any).answerFiles} />
                  <p className="text-xs text-muted-foreground mt-3">
                    Администратор рассматривает ваш ответ. После проверки вы
                    получите уведомление в Telegram.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* ── Right: available requests ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold">
            Доступные обращения
            {available.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {available.length}
              </span>
            )}
          </h2>

          {available.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Нет доступных обращений
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {available.map((req) => (
                <Card key={req._id} className="overflow-hidden">
                  <CardContent className="pt-3 pb-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground">
                        {getCategoryName(req.categoryId)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                        {formatDate(req.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-3 leading-relaxed">
                      {req.text}
                    </p>
                    <Button
                      size="sm"
                      className="w-full mt-1"
                      disabled={busy || !!activeRequest}
                      onClick={() => handleTake(req._id)}
                    >
                      Взять в работу
                    </Button>
                    {!!activeRequest && (
                      <p className="text-xs text-muted-foreground text-center">
                        Сначала завершите текущее задание
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm decline ────────────────────────────────────────────── */}
      <ConfirmDialog
        open={declineConfirm}
        onOpenChange={setDeclineConfirm}
        title="Отказаться от обращения?"
        description="Обращение вернётся в общую очередь и станет доступно другим студентам."
        confirmLabel="Отказаться"
        variant="destructive"
        loading={busy}
        onConfirm={() => {
          setDeclineConfirm(false);
          handleDecline();
        }}
      />
    </PageShell>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}

// ── Export with Suspense (required for useSearchParams in Next.js 15) ──────

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Задания">
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </PageShell>
      }
    >
      <TasksPageContent />
    </Suspense>
  );
}
