"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { requestsApi, type Request } from "@/lib/api";
import { MobileHeader } from "../../../_components/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, getCategoryName } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function UserRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
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
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader title="Обращение" back="/app/user" />

      <div className="px-4 py-4 space-y-4">
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
        </div>

        {/* Request files */}
        {request.requestFiles?.length > 0 && (
          <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Прикреплённые файлы
            </p>
            {request.requestFiles.map((f) => (
              <a
                key={f.filename}
                href={`${API_BASE}/files/${f.filename}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary"
              >
                📎 {f.originalName}
              </a>
            ))}
          </div>
        )}

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
            {request.answerFiles?.length > 0 && (
              <div className="space-y-1 pt-1">
                {request.answerFiles.map((f) => (
                  <a
                    key={f.filename}
                    href={`${API_BASE}/files/${f.filename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-green-700"
                  >
                    📎 {f.originalName}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin comment (answered/assigned) */}
        {request.adminComment && (
          <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Комментарий администратора
            </p>
            <p className="text-sm">{request.adminComment}</p>
          </div>
        )}
      </div>
    </div>
  );
}
