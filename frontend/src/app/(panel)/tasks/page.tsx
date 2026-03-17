"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, CheckCircle, XCircle, CheckCheck } from "lucide-react";
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
import { useToast } from "@/components/ui/toast-provider";
import { useDialog } from "@/components/ui/dialog-provider";
import { formatDate, getCategoryName } from "@/lib/utils";

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const dialog = useDialog();

  const [activeRequest, setActiveRequest] = useState<Request | null>(null);
  const [available, setAvailable] = useState<Request[]>([]);
  const [myStats, setMyStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");

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
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!activeRequest) return;
    const ok = await dialog.confirm(
      "Обращение вернётся в очередь. Это действие будет записано в ваш журнал.",
      {
        title: "Отказаться от обращения?",
        variant: "destructive",
        confirmLabel: "Отказаться",
      }
    );
    if (!ok) return;
    run(
      () => requestsApi.decline(activeRequest._id),
      "Отказались от обращения"
    );
  };

  const handleSubmit = async () => {
    if (!activeRequest || !answer.trim()) return;
    const ok = await dialog.confirm(
      "Отправить ответ на проверку администратору?",
      {
        title: "Отправить ответ?",
        confirmLabel: "Отправить",
      }
    );
    if (!ok) return;
    run(
      () => requestsApi.submitAnswer(activeRequest._id, answer),
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
      {/* Stats mini-row */}
      {myStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {(
            [
              [CheckCircle, "text-green-500", myStats.approved, "Одобрено"],
              [XCircle, "text-red-500", myStats.rejected, "Отклонено"],
              [ClipboardList, "text-blue-500", myStats.submitted, "Ответов"],
              [
                CheckCheck,
                myStats.approvalRate >= 80
                  ? "text-green-500"
                  : "text-amber-500",
                `${myStats.approvalRate}%`,
                "Одобрение",
              ],
            ] as [React.ElementType, string, number | string, string][]
          ).map(([Icon, color, value, label]) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-3 pt-4 pb-4">
                <Icon size={16} className={`shrink-0 ${color}`} />
                <div>
                  <p className="font-bold leading-tight">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main layout: stacks on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Active task — takes 2/3 on desktop */}
        <div className="lg:col-span-2">
          {activeRequest ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-sm">Текущее задание</CardTitle>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={activeRequest.status} />
                    {activeRequest.status === "assigned" &&
                      activeRequest.timerDeadline && (
                        <Timer deadline={activeRequest.timerDeadline} />
                      )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {getCategoryName(activeRequest.categoryId)} ·{" "}
                    {formatDate(activeRequest.createdAt)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {activeRequest.text}
                  </p>
                </div>

                {activeRequest.adminComment && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <span className="font-medium">Комментарий: </span>
                    {activeRequest.adminComment}
                  </div>
                )}

                {activeRequest.status === "assigned" && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Введите ответ на обращение..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={6}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={!answer.trim() || busy}
                        onClick={handleSubmit}
                      >
                        <CheckCheck size={13} /> Отправить ответ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        disabled={busy}
                        onClick={handleDecline}
                      >
                        <XCircle size={13} /> Отказаться
                      </Button>
                    </div>
                  </div>
                )}

                {activeRequest.status === "answered" && (
                  <p className="text-sm text-muted-foreground italic">
                    Ответ отправлен на проверку администратору.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <ClipboardList
                  size={32}
                  className="mx-auto mb-3 text-muted-foreground/40"
                />
                <p className="text-sm text-muted-foreground">
                  Нет активного задания. Возьмите обращение из списка.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Available requests — 1/3 on desktop, full width on mobile */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            Доступные ({available.length})
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
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-0.5">
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
    </PageShell>
  );
}
