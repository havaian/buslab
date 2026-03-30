"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Paperclip,
  X,
  AlertCircle,
} from "lucide-react";
import { requestsApi, type Request } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timer } from "@/components/shared/timer";
import { FileList } from "@/components/shared/file-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate, getCategoryName } from "@/lib/utils";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Answer form state
  const [answer, setAnswer] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [declineConfirm, setDeclineConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      const req = await requestsApi.findById(id);
      setRequest(req);
    } catch {
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleTake = () =>
    run(() => requestsApi.take(id), "Обращение взято в работу");

  const handleDecline = () =>
    run(() => requestsApi.decline(id), "Обращение возвращено в очередь");

  const handleSubmit = async () => {
    if (!answer.trim()) return toast("Введите текст ответа", "error");
    const fileList =
      files.length > 0
        ? (() => {
            const dt = new DataTransfer();
            files.forEach((f) => dt.items.add(f));
            return dt.files;
          })()
        : undefined;
    await run(
      () => requestsApi.submitAnswer(id, answer, fileList),
      "Ответ отправлен на проверку"
    );
    setAnswer("");
    setFiles([]);
  };

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...incoming.filter((f) => !names.has(f.name))];
    });
    e.target.value = "";
  };

  const backButton = (
    <Button variant="outline" size="sm" onClick={() => router.back()}>
      <ArrowLeft size={14} />
      Назад
    </Button>
  );

  if (loading) {
    return (
      <PageShell title="Обращение" actions={backButton}>
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  if (!request) {
    return (
      <PageShell title="Обращение" actions={backButton}>
        <p className="text-sm text-muted-foreground">
          Обращение не найдено или недоступно.
        </p>
      </PageShell>
    );
  }

  const studentObj =
    request.studentId && typeof request.studentId === "object"
      ? request.studentId
      : null;

  const isMyRequest = studentObj?._id === user?.id;
  const isAvailable = request.status === "approved";

  // Student should only see available requests or their own
  const canView = isAvailable || isMyRequest;

  if (!canView) {
    return (
      <PageShell title="Обращение" actions={backButton}>
        <p className="text-sm text-muted-foreground">
          Это обращение недоступно.
        </p>
      </PageShell>
    );
  }

  const canTake = isAvailable;
  const canAnswer = isMyRequest && request.status === "assigned";
  const canDecline = isMyRequest && request.status === "assigned";

  return (
    <PageShell
      title={`Обращение #${request._id.slice(-6)}`}
      actions={backButton}
    >
      <div className="space-y-3 max-w-2xl">
        {/* Status / meta row */}
        <Card>
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <StatusBadge status={request.status} />
              <span className="text-sm text-muted-foreground">
                {getCategoryName(request.categoryId)}
              </span>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {formatDate(request.createdAt)}
              </span>
            </div>

            {/* Timer for active assignment */}
            {canAnswer && request.timerDeadline && (
              <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                <Clock size={14} className="shrink-0" />
                <Timer deadline={request.timerDeadline} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question text */}
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm">Вопрос</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1">
            <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
              {request.text}
            </p>
            {request.requestFiles && request.requestFiles.length > 0 && (
              <div className="mt-3">
                <FileList files={request.requestFiles} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Take button — available request not yet taken */}
        {canTake && (
          <Button className="w-full" onClick={handleTake} disabled={busy}>
            <CheckCircle size={15} />
            Взять в работу
          </Button>
        )}

        {/* Answer form — student's active request */}
        {canAnswer && (
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm">Мой ответ</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-1 space-y-3">
              <Textarea
                placeholder="Введите ответ на обращение..."
                rows={7}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="text-sm resize-none"
              />

              {/* Attached files list */}
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded px-2 py-1"
                    >
                      <Paperclip size={12} className="shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <button
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={addFiles}
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  <Paperclip size={14} />
                  Файл
                </Button>
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={busy || !answer.trim()}
                >
                  <Send size={14} />
                  Отправить на проверку
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decline button */}
        {canDecline && (
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => setDeclineConfirm(true)}
            disabled={busy}
          >
            <XCircle size={14} />
            Отказаться от обращения
          </Button>
        )}

        {/* Submitted answer — answered / closed state */}
        {isMyRequest &&
          (request.status === "answered" || request.status === "closed") && (
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm">
                  {request.status === "closed"
                    ? "Принятый ответ"
                    : "Мой ответ (на проверке)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1 space-y-2">
                <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                  {request.finalAnswerText || request.answerText}
                </p>
                {request.answerFiles && request.answerFiles.length > 0 && (
                  <FileList files={request.answerFiles} />
                )}
                {request.adminComment && (
                  <div className="flex gap-2 text-xs text-muted-foreground border-l-2 border-muted pl-3 mt-2">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <span>{request.adminComment}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        {/* Decline reason if request was declined by admin */}
        {request.status === "declined" && request.declineReason && (
          <Card>
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Причина отклонения
              </p>
              <p className="text-sm">{request.declineReason}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={declineConfirm}
        title="Отказаться от обращения?"
        description="Обращение вернётся в очередь и станет доступным для других студентов."
        confirmLabel="Отказаться"
        variant="destructive"
        onConfirm={() => {
          setDeclineConfirm(false);
          handleDecline();
        }}
        onOpenChange={setDeclineConfirm}
      />
    </PageShell>
  );
}
