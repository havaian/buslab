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
} from "lucide-react";
import {
  requestsApi,
  adminUsersApi,
  type Request,
  type PanelUser,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timer } from "@/components/shared/timer";
import { useToast } from "@/components/ui/toast-provider";
import { useDialog } from "@/components/ui/dialog-provider";
import { formatDate, getCategoryName, getUserDisplayName } from "@/lib/utils";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const dialog = useDialog();

  const [request, setRequest] = useState<Request | null>(null);
  const [freeStudents, setFreeStudents] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [finalAnswer, setFinalAnswer] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");

  const reload = async () => {
    const r = await requestsApi.findById(id);
    setRequest(r);
    setFinalAnswer(r.answerText || "");
  };

  useEffect(() => {
    Promise.all([requestsApi.findById(id), adminUsersApi.freeStudents()])
      .then(([r, s]) => {
        setRequest(r);
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
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
            <CardContent>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {request.text}
              </p>
            </CardContent>
          </Card>

          {/* Answer */}
          {(request.status === "answered" || request.status === "closed") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {request.status === "closed"
                    ? "Финальный ответ"
                    : "Ответ студента (на проверке)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {request.status === "answered" ? (
                  <>
                    <Textarea
                      value={finalAnswer}
                      onChange={(e) => setFinalAnswer(e.target.value)}
                      rows={8}
                      className="text-sm"
                    />
                    {request.adminComment && (
                      <p className="text-xs text-muted-foreground border-l-2 pl-3">
                        Комментарий: {request.adminComment}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {request.finalAnswerText || request.answerText}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* Citizen */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Пользователь</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {citizen ? (
                <>
                  <button
                    className="font-medium hover:underline text-left w-full truncate"
                    onClick={() => router.push(`/users/${citizen._id}`)}
                  >
                    {getUserDisplayName(citizen)}
                  </button>
                  {citizen.username && (
                    <p className="text-muted-foreground">@{citizen.username}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    TG ID: {citizen.telegramId}
                  </p>
                  {citizen.language && (
                    <p className="text-muted-foreground text-xs">
                      Язык: {citizen.language.toUpperCase()}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1"
                    onClick={async () => {
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
                <p className="text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          {/* Timer */}
          {request.status === "assigned" && request.timerDeadline && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Таймер</CardTitle>
              </CardHeader>
              <CardContent>
                <Timer deadline={request.timerDeadline} />
              </CardContent>
            </Card>
          )}

          {/* Student */}
          {student && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Исполнитель</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <button
                  className="font-medium hover:underline text-left w-full truncate"
                  onClick={() => router.push(`/students/${student._id}`)}
                >
                  {getUserDisplayName(student)}
                </button>
                {student.username && (
                  <p className="text-muted-foreground">@{student.username}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Действия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* pending */}
              {request.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await dialog.confirm("Одобрить обращение?", {
                        confirmLabel: "Одобрить",
                      });
                      if (ok) run(() => requestsApi.approve(id), "Одобрено");
                    }}
                  >
                    <CheckCheck size={13} /> Одобрить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
                    disabled={busy}
                    onClick={async () => {
                      const reason = await dialog.prompt(
                        "Укажите причину отклонения:",
                        {
                          title: "Отклонить обращение?",
                          placeholder: "Причина...",
                          variant: "destructive",
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
                </>
              )}

              {/* approved */}
              {request.status === "approved" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Назначить студента
                    </Label>
                    <Select
                      value={assignStudentId}
                      onValueChange={setAssignStudentId}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Выбрать студента" />
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

              {/* answered */}
              {request.status === "answered" && (
                <>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await dialog.confirm(
                        "Подтвердить и отправить ответ пользователю?",
                        { confirmLabel: "Подтвердить" }
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
                    size="sm"
                    variant="outline"
                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
                    disabled={busy}
                    onClick={async () => {
                      const comment = await dialog.prompt(
                        "Укажите комментарий для студента:",
                        {
                          title: "Вернуть на доработку?",
                          placeholder: "Комментарий...",
                          variant: "destructive",
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

              {/* closed / declined */}
              {(request.status === "closed" ||
                request.status === "declined") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await dialog.confirm("Переоткрыть обращение?", {
                      confirmLabel: "Переоткрыть",
                    });
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
    </PageShell>
  );
}
