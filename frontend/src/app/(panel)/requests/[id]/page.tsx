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
  type AdminUser,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { FileList } from "@/components/shared/file-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate, getCategoryName } from "@/lib/utils";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [request, setRequest] = useState<Request | null>(null);
  const [freeStudents, setFreeStudents] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Action states
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
  }>({
    open: false,
    action: () => {},
    title: "",
  });
  const answerFilesRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const r = await requestsApi.findById(id);
    setRequest(r);
    setFinalAnswer(r.studentAnswer || "");
  };

  useEffect(() => {
    Promise.all([requestsApi.findById(id), adminUsersApi.freeStudents()])
      .then(([r, s]) => {
        setRequest(r);
        setFreeStudents(s);
        setFinalAnswer(r.studentAnswer || "");
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

  const student = request.studentId as AdminUser | null;

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
        {/* Left: main info */}
        <div className="col-span-2 space-y-4">
          {/* Request text */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
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
              <FileList files={request.files} />
            </CardContent>
          </Card>

          {/* Student answer */}
          {(request.status === "answer_review" ||
            request.status === "closed") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {request.status === "closed"
                    ? "Финальный ответ"
                    : "Ответ студента"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Admin can edit before approving */}
                {request.status === "answer_review" ? (
                  <>
                    <Textarea
                      value={finalAnswer}
                      onChange={(e) => setFinalAnswer(e.target.value)}
                      rows={8}
                      className="text-sm"
                    />
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Прикрепить файлы к ответу
                      </Label>
                      <input
                        ref={answerFilesRef}
                        type="file"
                        multiple
                        className="text-xs"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {request.finalAnswer}
                    </p>
                    <FileList files={request.finalAnswerFiles} />
                  </>
                )}
                {request.adminComment && (
                  <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-xs text-orange-800">
                    <span className="font-medium">Комментарий: </span>
                    {request.adminComment}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Student's original (for closed, show separately) */}
          {request.status === "closed" &&
            request.studentAnswer !== request.finalAnswer && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">
                    Оригинал ответа студента
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
                    {request.studentAnswer}
                  </p>
                  <FileList files={request.studentAnswerFiles} />
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
          {/* User info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Пользователь</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="font-medium">
                {request.userFirstName} {request.userLastName}
              </p>
              {request.userUsername && (
                <p className="text-muted-foreground">@{request.userUsername}</p>
              )}
              <p className="text-xs text-muted-foreground">
                TG ID: {request.telegramUserId}
              </p>
              <p className="text-xs text-muted-foreground">
                Язык: {request.userLanguage}
              </p>
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
          {request.status === "in_progress" && (
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
                <p className="font-medium">
                  {student.firstName} {student.lastName}
                </p>
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
              {/* PENDING */}
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

              {/* APPROVED */}
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

              {/* IN_PROGRESS */}
              {request.status === "in_progress" && (
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

              {/* ANSWER_REVIEW */}
              {request.status === "answer_review" && (
                <>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      confirm("Одобрить и отправить ответ пользователю?", () =>
                        run(
                          () =>
                            requestsApi.approveAnswer(
                              id,
                              finalAnswer,
                              answerFilesRef.current?.files ?? undefined
                            ),
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

              {/* CLOSED / REJECTED */}
              {(request.status === "closed" ||
                request.status === "rejected") && (
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
