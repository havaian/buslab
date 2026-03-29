"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  requestsApi,
  adminUsersApi,
  type Request,
  type PanelUser,
} from "@/lib/api";
import { MobileHeader } from "../../../_components/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileList } from "@/components/shared/file-list";
import { Timer } from "@/components/shared/timer";
import { useToast } from "@/components/ui/toast-provider";
import { useDialog } from "@/components/ui/dialog-provider";
import { formatDate, getCategoryName, getUserDisplayName } from "@/lib/utils";

export default function AdminRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const dialog = useDialog();

  const [request, setRequest] = useState<Request | null>(null);
  const [freeStudents, setFreeStudents] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [assignId, setAssignId] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");

  const reload = async () => {
    const r = await requestsApi.findById(id);
    setRequest(r);
    setFinalAnswer(r.answerText || "");
  };

  useEffect(() => {
    Promise.all([requestsApi.findById(id), adminUsersApi.freeStudents()])
      .then(([r, s]) => {
        setRequest(r);
        setFinalAnswer(r.answerText || "");
        setFreeStudents(s);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(msg, "success");
      await reload();
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !request) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Загрузка...
      </div>
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
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader title="Обращение" back="/app/admin" />

      <div className="px-4 py-4 space-y-3 pb-24">
        {/* Status + meta */}
        <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatDate(request.createdAt)}
            </span>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {getCategoryName(request.categoryId)}
          </p>
          {citizen && (
            <p className="text-xs">
              <span className="text-muted-foreground">Гражданин: </span>
              {getUserDisplayName(citizen)}
              {citizen.username && (
                <span className="text-muted-foreground">
                  {" "}
                  @{citizen.username}
                </span>
              )}
            </p>
          )}
          {student && (
            <p className="text-xs">
              <span className="text-muted-foreground">Студент: </span>
              {getUserDisplayName(student)}
            </p>
          )}
          {request.status === "assigned" && request.timerDeadline && (
            <Timer deadline={request.timerDeadline} />
          )}
        </div>

        {/* Request text */}
        <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Текст обращения
          </p>
          <p className="text-sm whitespace-pre-wrap">{request.text}</p>
        </div>

        {/* Request files */}
        {request.requestFiles?.length > 0 && (
          <div className="rounded-xl border bg-card px-4 py-3">
            <FileList files={request.requestFiles} />
          </div>
        )}

        {/* Decline reason */}
        {request.declineReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-red-600">Причина отказа</p>
            <p className="text-sm text-red-700">{request.declineReason}</p>
          </div>
        )}

        {/* Answer */}
        {request.answerText && (
          <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Ответ студента
            </p>
            <p className="text-sm whitespace-pre-wrap">{request.answerText}</p>
            {request.answerFiles?.length > 0 && (
              <FileList files={request.answerFiles} />
            )}
          </div>
        )}

        {/* Final answer edit */}
        {(request.status === "answered" || request.status === "closed") &&
          request.finalAnswerText && (
            <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Итоговый ответ
              </p>
              <p className="text-sm whitespace-pre-wrap">
                {request.finalAnswerText}
              </p>
            </div>
          )}

        {/* ── Actions ── */}
        <div className="space-y-2 pt-2">
          {/* pending */}
          {request.status === "pending" && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  run(() => requestsApi.approve(id), "Обращение одобрено")
                }
                className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Одобрить
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  const reason = await dialog.prompt("Причина отклонения:", {
                    title: "Отклонить",
                    placeholder: "Причина...",
                  });
                  if (!reason) return;
                  run(() => requestsApi.reject(id, reason), "Отклонено");
                }}
                className="w-full rounded-xl border border-destructive py-3 text-sm font-medium text-destructive disabled:opacity-50"
              >
                Отклонить
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  const ok = await dialog.confirm(
                    "Отклонить стандартной причиной?",
                    { variant: "destructive", confirmLabel: "Отклонить" }
                  );
                  if (ok)
                    run(() => requestsApi.rejectStandard(id), "Отклонено");
                }}
                className="w-full rounded-xl border py-3 text-sm font-medium text-muted-foreground disabled:opacity-50"
              >
                Стандартный отказ
              </button>
            </>
          )}

          {/* approved — assign student */}
          {request.status === "approved" && (
            <>
              <select
                value={assignId}
                onChange={(e) => setAssignId(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-3 text-sm focus:outline-none"
              >
                <option value="">Выбрать студента...</option>
                {freeStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getUserDisplayName(s)}
                    {s.username ? ` (@${s.username})` : ""}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !assignId}
                onClick={() =>
                  run(
                    () => requestsApi.assign(id, assignId),
                    "Студент назначен"
                  )
                }
                className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Назначить
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    () => requestsApi.returnToQueue(id),
                    "Возвращено в очередь"
                  )
                }
                className="w-full rounded-xl border py-3 text-sm font-medium text-muted-foreground"
              >
                Вернуть в очередь
              </button>
            </>
          )}

          {/* assigned */}
          {request.status === "assigned" && (
            <button
              disabled={busy}
              onClick={() =>
                run(() => requestsApi.unassign(id), "Студент снят")
              }
              className="w-full rounded-xl border py-3 text-sm font-medium text-muted-foreground"
            >
              Снять студента
            </button>
          )}

          {/* answered */}
          {request.status === "answered" && (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Итоговый ответ</p>
                <textarea
                  value={finalAnswer}
                  onChange={(e) => setFinalAnswer(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    () => requestsApi.approveAnswer(id, finalAnswer),
                    "Ответ одобрен"
                  )
                }
                className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Одобрить ответ
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  const comment = await dialog.prompt(
                    "Комментарий для студента:",
                    {
                      title: "Вернуть на доработку",
                      placeholder: "Что исправить...",
                    }
                  );
                  if (!comment) return;
                  run(
                    () => requestsApi.rejectAnswer(id, comment),
                    "Возвращено на доработку"
                  );
                }}
                className="w-full rounded-xl border border-destructive py-3 text-sm font-medium text-destructive"
              >
                Вернуть на доработку
              </button>
            </>
          )}

          {/* closed/declined — reopen */}
          {(request.status === "closed" || request.status === "declined") && (
            <button
              disabled={busy}
              onClick={async () => {
                const ok = await dialog.confirm("Вернуть в очередь?");
                if (ok) run(() => requestsApi.returnToQueue(id), "Переоткрыто");
              }}
              className="w-full rounded-xl border py-3 text-sm font-medium text-muted-foreground"
            >
              Переоткрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
