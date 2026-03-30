"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requestsApi, type Request } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileList } from "@/components/shared/file-list";
import { formatDate, getCategoryName } from "@/lib/utils";

export default function UserRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestsApi
      .findById(id)
      .then(setRequest)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !request) {
    return (
      <PageShell title="Обращение">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Обращение"
      actions={
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={14} /> Назад
        </Button>
      }
    >
      <div className="space-y-4 max-w-2xl">
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
        </div>

        {/* Request text */}
        <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Текст обращения
          </p>
          <p className="text-sm whitespace-pre-wrap">{request.text}</p>
          <FileList files={request.requestFiles} />
        </div>

        {/* Decline reason */}
        {request.status === "declined" && request.declineReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-red-600">Причина отказа</p>
            <p className="text-sm text-red-700">{request.declineReason}</p>
          </div>
        )}

        {/* Final answer */}
        {request.status === "closed" && request.finalAnswerText && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-green-700">
              Ответ юридической клиники
            </p>
            <p className="text-sm whitespace-pre-wrap text-green-900">
              {request.finalAnswerText}
            </p>
            <FileList files={request.answerFiles} />
          </div>
        )}

        {/* Admin comment */}
        {request.adminComment && (
          <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Комментарий администратора
            </p>
            <p className="text-sm">{request.adminComment}</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
