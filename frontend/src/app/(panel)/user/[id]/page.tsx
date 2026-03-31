"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { requestsApi, type Request } from "@/lib/api";
import { MobileHeader } from "@/components/layout/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileList } from "@/components/shared/file-list";
import { formatDate, getCategoryName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает проверки",
  approved: "Принято к обработке",
  declined: "Отклонено",
  assigned: "В работе",
  answered: "Ответ на проверке",
  closed: "Закрыто",
};

export default function UserRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestsApi
      .findById(id)
      .then(setRequest)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <MobileHeader title="Обращение" back />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col min-h-full">
        <MobileHeader title="Обращение" back />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Обращение не найдено</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader title={`Обращение #${request._id.slice(-6)}`} back />
      <div className="flex-1 p-4 space-y-3 max-w-2xl">
        {/* Status + meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={request.status} />
          <span className="text-xs text-muted-foreground">
            {getCategoryName(request.categoryId)}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDate(request.createdAt)}
          </span>
        </div>

        {/* Request text */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {request.text}
            </p>
            <FileList files={request.requestFiles} />
          </CardContent>
        </Card>

        {/* Decline reason */}
        {request.status === "declined" && request.declineReason && (
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm text-destructive">
                Причина отклонения
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-1">
              <p className="text-sm">{request.declineReason}</p>
            </CardContent>
          </Card>
        )}

        {/* Answer */}
        {request.status === "closed" && (
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm text-green-700">
                Ответ юридической клиники
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-1 space-y-2">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {request.finalAnswerText || request.answerText}
              </p>
              <FileList files={request.answerFiles} />
            </CardContent>
          </Card>
        )}

        {/* In progress notice */}
        {(request.status === "assigned" || request.status === "answered") && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">
                Ваше обращение в работе. Мы уведомим вас когда ответ будет
                готов.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
