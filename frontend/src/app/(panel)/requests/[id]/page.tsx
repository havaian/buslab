"use client";

import { useEffect, useState, useRef } from "react";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate, getCategoryName, getUserDisplayName } from "@/lib/utils";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [request, setRequest] = useState<Request | null>(null);
  const [freeStudents, setFreeStudents] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectAnswerComment, setRejectAnswerComment] = useState("");
  const [showRejectAnswerInput, setShowRejectAnswerInput] = useState(false);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");
  const [directMessage, setDirectMessage] = useState("");
  const [showMsgInput, setShowMsgInput] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: () => void;
    title: string;
    desc?: string;
    variant?: "default" | "destructive";
  }>({ open: false, action: () => {}, title: "" });

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

  const confirm = (
    title: string,
    action: () => void,
    desc?: string,
    variant?: "default" | "destructive"
  ) => {
    setConfirmDialog({ open: true, title, action, desc, variant });
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
      <div className="grid grid-cols-3 gap-5">
        {/* Left: main content */}
        <div className="col-span-2 space-y-4">
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
                  <Textarea
                    value={finalAnswer}
                    onChange={(e) => setFinalAnswer(e.target.value)}
                    rows={8}
                    className="text-sm"
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {request.finalAnswerText || request.answerText || "—"}
                  </p>
                )}
                {request.adminComment && (
                  <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-xs text-orange-800">
                    <span className="font-medium">Комментарий: </span>
                    {request.adminComment}
                  </div>
                )}
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

          {/* Direct message */}
          {showMsgInput && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Сообщение пользователю
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  placeholder="Текст сообщения..."
                  value={directMessage}
                  onChange={(e) => setDirectMessage(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!directMessage.trim() || busy}
                    onClick={() =>
                      run(
                        () =>
                          requestsApi
                            .sendMessage(id, directMessage)
                            .then(() => setDirectMessage("")),
                        "Сообщение отправлено"
                      )
                    }
                  >
                    <Send size={13} /> Отправить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowMsgInput(false)}
                  >
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* Citizen info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Пользователь</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {citizen ? (
                <>
                  <p className="font-medium">{getUserDisplayName(citizen)}</p>
                  {citizen.username && (
                    <p className="text-muted-foreground">@{citizen.username}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    TG ID: {citizen.telegramId}
                  </p>
                  {citizen.language && (
                    <p className="text-xs text-muted-foreground">
                      Язык: {citizen.language}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-xs">Нет данных</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={() => setShowMsgInput(true)}
              >
                <Send size={13} /> Написать
              </Button>
            </CardContent>
          </Card>

          {/* Timer */}
          {request.status === "assigned" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Таймер</CardTitle>
              </CardHeader>
              <CardContent>
                <Timer deadline={request.timerDeadline} />
                {request.timerDeadline && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Дедлайн: {formatDate(request.timerDeadline)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Student */}
          {student && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Исполнитель</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{getUserDisplayName(student)}</p>
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
              {request.status === "pending" && (
                <>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      confirm("Одобрить обращение?", () =>
                        run(() => requestsApi.approve(id), "Одобрено")
                      )
                    }
                  >
                    <CheckCheck size={13} /> Одобрить
                  </Button>
                  {!showRejectInput ? (
                    <Button
                      variant="destructive"
                      className="w-full"
                      size="sm"
                      onClick={() => setShowRejectInput(true)}
                    >
                      <XCircle size={13} /> Отклонить
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Причина отклонения..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        disabled={!rejectReason.trim() || busy}
                        onClick={() =>
                          run(
                            () => requestsApi.reject(id, rejectReason),
                            "Отклонено"
                          )
                        }
                      >
                        Подтвердить
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowRejectInput(false)}
                      >
                        Отмена
                      </Button>
                    </div>
                  )}
                </>
              )}

              {request.status === "approved" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Назначить студента</Label>
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
                            {s.firstName} {s.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!assignStudentId || busy}
                      onClick={() =>
                        confirm("Назначить студента?", () =>
                          run(
                            () => requestsApi.assign(id, assignStudentId),
                            "Студент назначен"
                          )
                        )
                      }
                    >
                      <UserCheck size={13} /> Назначить
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={() =>
                      confirm("Вернуть в очередь?", () =>
                        run(
                          () => requestsApi.returnToQueue(id),
                          "Возвращено в очередь"
                        )
                      )
                    }
                  >
                    <RotateCcw size={13} /> Вернуть в очередь
                  </Button>
                </>
              )}

              {request.status === "assigned" && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={() =>
                      confirm(
                        "Снять со студента?",
                        () =>
                          run(() => requestsApi.unassign(id), "Задание снято"),
                        undefined,
                        "destructive"
                      )
                    }
                  >
                    <UserX size={13} /> Снять со студента
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={() =>
                      confirm("Вернуть в очередь?", () =>
                        run(
                          () => requestsApi.returnToQueue(id),
                          "Возвращено в очередь"
                        )
                      )
                    }
                  >
                    <RotateCcw size={13} /> Вернуть в очередь
                  </Button>
                </>
              )}

              {request.status === "answered" && (
                <>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      confirm("Одобрить и отправить ответ пользователю?", () =>
                        run(
                          () => requestsApi.approveAnswer(id, finalAnswer),
                          "Ответ одобрен и отправлен"
                        )
                      )
                    }
                  >
                    <CheckCheck size={13} /> Одобрить ответ
                  </Button>
                  {!showRejectAnswerInput ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowRejectAnswerInput(true)}
                    >
                      <XCircle size={13} /> Вернуть на правку
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Комментарий студенту..."
                        value={rejectAnswerComment}
                        onChange={(e) => setRejectAnswerComment(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        disabled={!rejectAnswerComment.trim() || busy}
                        onClick={() =>
                          run(
                            () =>
                              requestsApi.rejectAnswer(id, rejectAnswerComment),
                            "Возвращено на правку"
                          )
                        }
                      >
                        Подтвердить
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowRejectAnswerInput(false)}
                      >
                        Отмена
                      </Button>
                    </div>
                  )}
                </>
              )}

              {(request.status === "closed" ||
                request.status === "declined") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    confirm("Вернуть в очередь (переоткрыть)?", () =>
                      run(() => requestsApi.returnToQueue(id), "Переоткрыто")
                    )
                  }
                >
                  <RotateCcw size={13} /> Переоткрыть
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(v) => setConfirmDialog((p) => ({ ...p, open: v }))}
        title={confirmDialog.title}
        description={confirmDialog.desc}
        variant={confirmDialog.variant}
        loading={busy}
        onConfirm={() => {
          setConfirmDialog((p) => ({ ...p, open: false }));
          confirmDialog.action();
        }}
      />
    </PageShell>
  );
}
