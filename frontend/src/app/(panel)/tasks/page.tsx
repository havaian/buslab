"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, ClipboardList, CheckCheck } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Timer } from "@/components/shared/timer";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileList } from "@/components/shared/file-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate, getCategoryName } from "@/lib/utils";

export default function TasksPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [activeRequest, setActiveRequest] = useState<Request | null>(null);
  const [available, setAvailable] = useState<Request[]>([]);
  const [myStats, setMyStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [answer, setAnswer] = useState("");
  const answerFilesRef = useRef<HTMLInputElement>(null);
  const [declineConfirm, setDeclineConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [history, avail, stats] = await Promise.all([
        requestsApi.myHistory(),
        requestsApi.available(),
        adminUsersApi.studentStats(user.id),
      ]);
      // Active = IN_PROGRESS or ANSWER_REVIEW assigned to this student
      const active =
        history.find(
          (r) => r.status === "in_progress" || r.status === "answer_review"
        ) || null;
      setActiveRequest(active);
      setAvailable(avail);
      setMyStats(stats);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(successMsg, "success");
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = () => {
    if (!activeRequest || !answer.trim()) return;
    run(
      () =>
        requestsApi.submitAnswer(
          activeRequest._id,
          answer,
          answerFilesRef.current?.files ?? undefined
        ),
      "Ответ отправлен на проверку"
    );
  };

  if (loading) {
    return (
      <PageShell title="Задания">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  return (
    <PageShell title="Задания">
      {/* Personal mini-stats */}
      {myStats && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            {
              label: "Одобрено",
              value: myStats.approved,
              color: "text-green-600",
            },
            {
              label: "Отклонено",
              value: myStats.rejected,
              color: "text-red-500",
            },
            {
              label: "Всего ответов",
              value: myStats.submitted,
              color: "text-blue-600",
            },
            {
              label: "Рейтинг",
              value: myStats.rating !== null ? `${myStats.rating}%` : "—",
              color: "text-primary",
            },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* Current task */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Текущее задание</h2>
          {!activeRequest ? (
            <Card>
              <CardContent className="py-10 text-center">
                <ClipboardList
                  size={32}
                  className="text-muted-foreground mx-auto mb-3"
                />
                <p className="text-sm text-muted-foreground">
                  У вас нет активного задания
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Выберите обращение из списка справа
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={activeRequest.status} />
                    <span className="text-sm text-muted-foreground">
                      {getCategoryName(activeRequest.categoryId)}
                    </span>
                  </div>
                  {activeRequest.status === "in_progress" && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        Осталось:
                      </span>
                      <Timer deadline={activeRequest.timerDeadline} />
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {activeRequest.text}
                  </p>
                  <FileList files={activeRequest.files} />
                </CardContent>
              </Card>

              {/* Admin comment on rejected answer */}
              {activeRequest.adminComment && (
                <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-xs text-orange-800">
                  <span className="font-medium">
                    Комментарий администратора:{" "}
                  </span>
                  {activeRequest.adminComment}
                </div>
              )}

              {activeRequest.status === "answer_review" ? (
                <Card>
                  <CardContent className="pt-4 py-4 text-center">
                    <CheckCheck
                      size={24}
                      className="text-purple-500 mx-auto mb-2"
                    />
                    <p className="text-sm font-medium">
                      Ответ отправлен на проверку
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ожидайте решения администратора
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Ваш ответ</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Pre-fill previous answer on revisions */}
                    <Textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Напишите юридический ответ..."
                      rows={10}
                      className="text-sm"
                    />
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Прикрепить файлы
                      </Label>
                      <input
                        ref={answerFilesRef}
                        type="file"
                        multiple
                        className="text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        size="sm"
                        disabled={!answer.trim() || busy}
                        onClick={submitAnswer}
                      >
                        <CheckCircle size={13} /> Отправить ответ
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => setDeclineConfirm(true)}
                      >
                        <XCircle size={13} /> Отказаться
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Available requests */}
        <div>
          <h2 className="text-sm font-semibold mb-3">
            Доступные обращения ({available.length})
          </h2>
          {available.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Нет доступных обращений
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {available.map((r) => (
                <Card
                  key={r._id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {getCategoryName(r.categoryId)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-3 leading-relaxed">
                      {r.text}
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!!activeRequest || busy}
                      onClick={() =>
                        run(
                          () => requestsApi.take(r._id),
                          "Обращение взято в работу"
                        )
                      }
                    >
                      Взять в работу
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={declineConfirm}
        onOpenChange={setDeclineConfirm}
        title="Отказаться от обращения?"
        description="Обращение вернётся в очередь. Это действие будет записано в ваш журнал."
        variant="destructive"
        confirmLabel="Отказаться"
        loading={busy}
        onConfirm={() => {
          setDeclineConfirm(false);
          if (activeRequest)
            run(
              () => requestsApi.decline(activeRequest._id),
              "Отказались от обращения"
            );
        }}
      />
    </PageShell>
  );
}
