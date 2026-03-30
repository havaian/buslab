"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  RotateCcw,
  UserX,
  CheckCheck,
  XCircle,
  UserCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  ShieldCheck,
} from "lucide-react";
import {
  requestsApi,
  adminUsersApi,
  type Request,
  type PanelUser,
  type RequestHistoryEntry,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timer } from "@/components/shared/timer";
import { FileList } from "@/components/shared/file-list";
import { useToast } from "@/components/ui/toast-provider";
import { useDialog } from "@/components/ui/dialog-provider";
import { formatDate, getCategoryName, getUserDisplayName } from "@/lib/utils";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const dialog = useDialog();

  const [request, setRequest] = useState<Request | null>(null);
  const [history, setHistory] = useState<RequestHistoryEntry[]>([]);
  const [freeStudents, setFreeStudents] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [finalAnswer, setFinalAnswer] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");

  const reload = async () => {
    const [r, h] = await Promise.all([
      requestsApi.findById(id),
      requestsApi.getHistory(id),
    ]);
    setRequest(r);
    setHistory(h);
    setFinalAnswer(r.answerText || "");
  };

  useEffect(() => {
    Promise.all([
      requestsApi.findById(id),
      requestsApi.getHistory(id),
      adminUsersApi.freeStudents(),
    ])
      .then(([r, h, s]) => {
        setRequest(r);
        setHistory(h);
        setFreeStudents(s);
        setFinalAnswer(r.answerText || "");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(successMsg, "success");
      await reload();
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !request) {
    return (
      <PageShell title="Обращение">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  const citizen =
    request.userId && typeof request.userId === "object"
      ? request.userId
      : null;
  const student =
    request.studentId && typeof request.studentId === "object"
      ? request.studentId
      : null;

  return (
    <PageShell
      title={`Обращение #${request._id.slice(-6)}`}
      actions={
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={14} />
          Назад
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* ── Left: main content ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Request text */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={request.status} />
                <span className="text-sm text-muted-foreground">
                  {getCategoryName(request.categoryId)}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDate(request.createdAt)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {request.text}
              </p>
              {/* Citizen-attached files */}
              <FileList files={request.requestFiles} />
            </CardContent>
          </Card>

          {/* Answer card — shown when answered or closed */}
          {(request.status === "answered" || request.status === "closed") && (
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm">
                  {request.status === "closed"
                    ? "Финальный ответ"
                    : "Ответ студента (на проверке)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1 space-y-3">
                {/* Editable textarea for admin to tweak before approving */}
                {request.status === "answered" ? (
                  <>
                    <Textarea
                      value={finalAnswer}
                      onChange={(e) => setFinalAnswer(e.target.value)}
                      rows={8}
                      className="text-sm"
                    />
                    {/* Files attached by student */}
                    <FileList files={request.answerFiles} />
                    {request.adminComment && (
                      <p className="text-xs text-muted-foreground border-l-2 pl-3">
                        Комментарий: {request.adminComment}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {request.finalAnswerText || request.answerText}
                    </p>
                    {/* Files in closed state too */}
                    <FileList files={request.answerFiles} />
                    {/* Show original student answer if admin edited it */}
                    {request.status === "closed" &&
                      request.finalAnswerText &&
                      request.answerText &&
                      request.finalAnswerText !== request.answerText && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Оригинал ответа студента:
                          </p>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {request.answerText}
                          </p>
                        </div>
                      )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Decline reason */}
          {request.status === "declined" && request.declineReason && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Причина отклонения
                </p>
                <p className="text-sm">{request.declineReason}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Citizen card */}
          <Card
            className="cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => citizen && router.push(`/users/${citizen._id}`)}
          >
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm">Пользователь</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-1 space-y-1.5 text-sm">
              {citizen ? (
                <>
                  <span className="font-medium truncate">
                    {getUserDisplayName(citizen)}
                  </span>
                  {citizen.username && (
                    <p className="text-muted-foreground">@{citizen.username}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    TG ID: {citizen.telegramId}
                  </p>
                  {citizen.language && (
                    <p className="text-muted-foreground text-xs">
                      Язык: {(citizen.language as string).toUpperCase()}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const text = await dialog.prompt(
                        "Введите сообщение для пользователя:",
                        {
                          title: "Написать пользователю",
                          placeholder: "Текст сообщения...",
                          confirmLabel: "Отправить",
                        }
                      );
                      if (!text) return;
                      run(
                        () => requestsApi.sendMessage(id, text),
                        "Сообщение отправлено"
                      );
                    }}
                  >
                    <Send size={13} /> Написать
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">Нет данных</p>
              )}
            </CardContent>
          </Card>

          {/* Timer */}
          {request.status === "assigned" && request.timerDeadline && (
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm">Таймер</CardTitle>
              </CardHeader>
              <CardContent>
                <Timer deadline={request.timerDeadline} />
              </CardContent>
            </Card>
          )}

          {/* Student card */}
          {student && (
            <Card
              className="cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => router.push(`/students/${student._id}`)}
            >
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm">Исполнитель</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1 space-y-1.5 text-sm">
                <span className="font-medium truncate">
                  {getUserDisplayName(student)}
                </span>
                {student.username && (
                  <p className="text-muted-foreground">@{student.username}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm">Действия</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-1 space-y-2">
              {/* pending */}
              {request.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await dialog.confirm("Одобрить обращение?");
                      if (ok) run(() => requestsApi.approve(id), "Одобрено");
                    }}
                  >
                    <CheckCheck size={13} /> Одобрить
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      const reason = await dialog.prompt(
                        "Укажите причину отклонения:",
                        {
                          title: "Отклонить обращение",
                          placeholder: "Причина...",
                          confirmLabel: "Отклонить",
                        }
                      );
                      if (!reason) return;
                      run(
                        () => requestsApi.reject(id, reason),
                        "Обращение отклонено"
                      );
                    }}
                  >
                    <XCircle size={13} /> Отклонить
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await dialog.confirm(
                        "Отклонить стандартной причиной отказа?",
                        {
                          title: "Стандартный отказ",
                          variant: "destructive",
                          confirmLabel: "Отклонить",
                        }
                      );
                      if (!ok) return;
                      run(
                        () => requestsApi.rejectStandard(id),
                        "Обращение отклонено"
                      );
                    }}
                  >
                    <XCircle size={13} /> Стандартный отказ
                  </Button>
                </>
              )}

              {/* approved */}
              {request.status === "approved" && (
                <>
                  <div className="space-y-1.5">
                    <Select
                      value={assignStudentId}
                      onValueChange={setAssignStudentId}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Выбрать студента..." />
                      </SelectTrigger>
                      <SelectContent>
                        {freeStudents.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {getUserDisplayName(s)}
                            {s.username ? ` (@${s.username})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={busy || !assignStudentId}
                      onClick={async () => {
                        const ok = await dialog.confirm("Назначить студента?", {
                          confirmLabel: "Назначить",
                        });
                        if (ok)
                          run(
                            () => requestsApi.assign(id, assignStudentId),
                            "Студент назначен"
                          );
                      }}
                    >
                      <UserCheck size={13} /> Назначить
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await dialog.confirm("Вернуть в очередь?");
                      if (ok)
                        run(
                          () => requestsApi.returnToQueue(id),
                          "Возвращено в очередь"
                        );
                    }}
                  >
                    <RotateCcw size={13} /> Вернуть в очередь
                  </Button>
                </>
              )}

              {/* assigned */}
              {request.status === "assigned" && (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await dialog.confirm("Снять со студента?", {
                        variant: "destructive",
                        confirmLabel: "Снять",
                      });
                      if (ok)
                        run(
                          () => requestsApi.unassign(id),
                          "Снято со студента"
                        );
                    }}
                  >
                    <UserX size={13} /> Снять со студента
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await dialog.confirm("Вернуть в очередь?");
                      if (ok)
                        run(
                          () => requestsApi.returnToQueue(id),
                          "Возвращено в очередь"
                        );
                    }}
                  >
                    <RotateCcw size={13} /> Вернуть в очередь
                  </Button>
                </>
              )}

              {/* answered — approve or send back for revision */}
              {request.status === "answered" && (
                <>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await dialog.confirm(
                        "Одобрить и отправить ответ пользователю?",
                        { confirmLabel: "Одобрить" }
                      );
                      if (ok)
                        run(
                          () => requestsApi.approveAnswer(id, finalAnswer),
                          "Ответ одобрен и отправлен"
                        );
                    }}
                  >
                    <CheckCheck size={13} /> Подтвердить ответ
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      const comment = await dialog.prompt(
                        "Комментарий для студента:",
                        {
                          title: "Вернуть на доработку",
                          placeholder: "Что нужно исправить...",
                          confirmLabel: "Вернуть",
                        }
                      );
                      if (!comment) return;
                      run(
                        () => requestsApi.rejectAnswer(id, comment),
                        "Возвращено на доработку"
                      );
                    }}
                  >
                    <XCircle size={13} /> Вернуть на доработку
                  </Button>
                </>
              )}

              {/* closed / declined — reopen */}
              {(request.status === "closed" ||
                request.status === "declined") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await dialog.confirm(
                      "Вернуть обращение в очередь?",
                      { confirmLabel: "Переоткрыть" }
                    );
                    if (ok)
                      run(() => requestsApi.returnToQueue(id), "Переоткрыто");
                  }}
                >
                  <RotateCcw size={13} /> Переоткрыть
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── History timeline ──────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-3">История обращения</h2>
          <div className="relative border-l-2 border-muted ml-3 space-y-0">
            {history.map((entry, i) => (
              <HistoryEntry
                key={entry._id}
                entry={entry}
                last={i === history.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}

// ── History entry component ────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string }> = {
  request_submitted: { label: "Обращение подано", color: "bg-blue-500" },
  request_approved: { label: "Обращение одобрено", color: "bg-green-500" },
  request_rejected: { label: "Обращение отклонено", color: "bg-red-500" },
  student_took: { label: "Студент взял в работу", color: "bg-purple-500" },
  student_assigned: { label: "Студент назначен", color: "bg-purple-500" },
  student_unassigned: { label: "Студент снят", color: "bg-orange-500" },
  student_declined: { label: "Студент отказался", color: "bg-orange-500" },
  returned_to_queue: { label: "Возвращено в очередь", color: "bg-yellow-500" },
  answer_submitted: {
    label: "Ответ отправлен на проверку",
    color: "bg-blue-500",
  },
  answer_approved: { label: "Ответ одобрен", color: "bg-green-500" },
  answer_rejected: {
    label: "Ответ отклонён на доработку",
    color: "bg-red-500",
  },
  timer_expired: { label: "Таймер истёк", color: "bg-red-600" },
  answer_edited_by_admin: {
    label: "Ответ изменён администратором",
    color: "bg-yellow-500",
  },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает проверки",
  approved: "Одобрено",
  declined: "Отклонено",
  assigned: "В работе",
  answered: "Ответ на проверке",
  closed: "Закрыто",
};

function HistoryEntry({
  entry,
  last,
}: {
  entry: RequestHistoryEntry;
  last: boolean;
}) {
  const meta = ACTION_META[entry.action] ?? {
    label: entry.action,
    color: "bg-muted-foreground",
  };
  const performer = entry.performedBy;
  const performerName = performer
    ? `${performer.firstName} ${performer.lastName || ""}`.trim() ||
      performer.username
    : null;

  return (
    <div className={`relative pl-6 pb-5 ${last ? "" : ""}`}>
      {/* Dot */}
      <span
        className={`absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background ${meta.color}`}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium">{meta.label}</p>

          {/* Status transition */}
          {entry.statusFrom && entry.statusTo && (
            <p className="text-xs text-muted-foreground">
              {STATUS_LABELS[entry.statusFrom] ?? entry.statusFrom}
              {" → "}
              {STATUS_LABELS[entry.statusTo] ?? entry.statusTo}
            </p>
          )}

          {/* Performer */}
          {performerName && (
            <p className="text-xs text-muted-foreground">
              {entry.performedByRole === "admin" ? "Администратор" : "Студент"}:{" "}
              {performerName}
              {performer?.username ? ` (@${performer.username})` : ""}
            </p>
          )}

          {/* Comment / decline reason */}
          {entry.comment && (
            <div className="mt-1 rounded-md border-l-2 border-orange-300 bg-orange-50 pl-3 pr-2 py-1.5 text-xs text-orange-800">
              {entry.comment}
            </div>
          )}

          {/* Answer snapshot */}
          {entry.answerText && (
            <details className="mt-1">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">
                Текст ответа (снимок)
              </summary>
              <p className="mt-1 text-xs whitespace-pre-wrap leading-relaxed bg-muted/30 rounded p-2 border">
                {entry.answerText}
              </p>
            </details>
          )}

          {/* Answer files snapshot */}
          {entry.answerFiles?.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Файлы: {entry.answerFiles.map((f) => f.originalName).join(", ")}
            </p>
          )}
        </div>

        <time className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
          {new Date(entry.createdAt).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
}
