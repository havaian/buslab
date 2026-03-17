"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  adminUsersApi,
  type StudentStats,
  type StudentLogEntry,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function MyStatsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [logs, setLogs] = useState<StudentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      adminUsersApi.studentStats(user.id),
      adminUsersApi.studentLogs(user.id),
    ])
      .then(([s, l]) => {
        setStats(s);
        setLogs(l);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading || !stats) {
    return (
      <PageShell title="Моя статистика">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  return (
    <PageShell title="Моя статистика">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: stats */}
        <div className="space-y-4">
          {stats.rating !== null && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-4 pt-5 pb-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-2xl font-bold text-primary">
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

          <div className="grid grid-cols-2 gap-3">
            {(
              [
                [TrendingUp, "text-blue-600", stats.total, "Всего взято"],
                [
                  TrendingUp,
                  "text-purple-600",
                  stats.submitted,
                  "Отправлено ответов",
                ],
                [CheckCircle, "text-green-600", stats.approved, "Одобрено"],
                [XCircle, "text-red-500", stats.rejected, "Отклонено"],
                [
                  CheckCircle,
                  stats.approvalRate >= 80
                    ? "text-green-600"
                    : stats.approvalRate >= 50
                    ? "text-orange-500"
                    : "text-red-500",
                  `${stats.approvalRate}%`,
                  "Процент одобрения",
                ],
                [
                  Clock,
                  "text-muted-foreground",
                  stats.avgTime ? `${stats.avgTime} мин` : "—",
                  "Среднее время",
                ],
                [AlertTriangle, "text-red-500", stats.expired, "Просрочек"],
                [XCircle, "text-orange-500", stats.declines, "Отказов"],
              ] as [React.ElementType, string, number | string, string][]
            ).map(([Icon, color, value, label]) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 pt-4 pb-4">
                  <Icon size={16} className={`shrink-0 ${color}`} />
                  <div>
                    <p className="text-lg font-bold leading-tight">{value}</p>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: log */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Журнал действий ({logs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 py-4">
                Действий нет
              </p>
            ) : (
              <div className="divide-y max-h-[520px] overflow-y-auto">
                {logs.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          ACTION_COLORS[entry.action] ?? "text-foreground"
                        }`}
                      >
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </p>
                      {entry.timeSpentMinutes != null && (
                        <p className="text-xs text-muted-foreground">
                          Время: {entry.timeSpentMinutes} мин
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDate(entry.createdAt)}
                    </span>
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
