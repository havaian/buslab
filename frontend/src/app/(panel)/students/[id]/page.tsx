"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  adminUsersApi,
  type StudentStats,
  type StudentLogEntry,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  took_request: "Взял обращение",
  submitted_answer: "Отправил ответ",
  answer_approved: "Ответ одобрен",
  answer_rejected: "Ответ отклонён",
  declined_request: "Отказался от обращения",
  unassigned_by_admin: "Задание снято администратором",
  timer_expired: "Таймер истёк",
};

const ACTION_COLORS: Record<string, string> = {
  answer_approved: "text-green-600",
  answer_rejected: "text-red-500",
  timer_expired: "text-red-500",
  declined_request: "text-orange-500",
  unassigned_by_admin: "text-orange-500",
  took_request: "text-blue-600",
  submitted_answer: "text-purple-600",
};

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [logs, setLogs] = useState<StudentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminUsersApi.studentStats(id), adminUsersApi.studentLogs(id)])
      .then(([s, l]) => {
        setStats(s);
        setLogs(l);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !stats) {
    return (
      <PageShell title="Студент">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Статистика студента"
      actions={
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={14} />
          Назад
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-5">
        {/* Stats cards */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Всего взято",
                value: stats.total,
                icon: Clock,
                color: "text-blue-600",
              },
              {
                label: "Отправлено ответов",
                value: stats.submitted,
                icon: CheckCircle,
                color: "text-purple-600",
              },
              {
                label: "Одобрено",
                value: stats.approved,
                icon: CheckCircle,
                color: "text-green-600",
              },
              {
                label: "Отклонено",
                value: stats.rejected,
                icon: XCircle,
                color: "text-red-500",
              },
              {
                label: "Процент одобрения",
                value: `${stats.approvalRate}%`,
                icon: CheckCircle,
                color: "text-green-600",
              },
              {
                label: "Ср. время ответа",
                value: stats.avgTime ? `${stats.avgTime} мин` : "—",
                icon: Clock,
                color: "text-muted-foreground",
              },
              {
                label: "Просрочек",
                value: stats.expired,
                icon: AlertTriangle,
                color: "text-red-500",
              },
              {
                label: "Отказов",
                value: stats.declines,
                icon: XCircle,
                color: "text-orange-500",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 pt-4 pb-4">
                  <Icon size={16} className={color} />
                  <div>
                    <p className="text-lg font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {stats.rating !== null && (
            <Card>
              <CardContent className="flex items-center gap-4 pt-4 pb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-xl font-bold text-primary">
                    {stats.rating}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">Рейтинг</p>
                  <p className="text-xs text-muted-foreground">
                    На основе % одобрения (мин. 5 ответов)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action log */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="text-sm">Журнал действий</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {logs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Нет записей
              </p>
            ) : (
              <div className="divide-y">
                {logs.map((l) => (
                  <div key={l._id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          ACTION_COLORS[l.action] || ""
                        }`}
                      >
                        {ACTION_LABELS[l.action] || l.action}
                      </p>
                      {l.details && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {l.details}
                        </p>
                      )}
                      {l.timeSpentMinutes && (
                        <p className="text-xs text-muted-foreground">
                          Время: {l.timeSpentMinutes} мин
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(l.createdAt)}
                      </p>
                      <button
                        onClick={() => router.push(`/requests/${l.requestId}`)}
                        className="text-xs text-primary hover:underline mt-0.5"
                      >
                        #{String(l.requestId).slice(-6)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
