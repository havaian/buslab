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
  answer_approved: "✅ Ответ одобрен",
  answer_rejected: "❌ Ответ отклонён",
  declined_request: "Отказался от обращения",
  unassigned_by_admin: "Задание снято администратором",
  timer_expired: "⏰ Таймер истёк",
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
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-4">
          {/* Rating card */}
          {stats.rating !== null && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-4 pt-5 pb-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-2xl font-bold text-primary">
                    {stats.rating}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-lg">Рейтинг</p>
                  <p className="text-xs text-muted-foreground">
                    На основе процента одобрения
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Минимум 5 ответов для расчёта
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Всего взято",
                value: stats.total,
                icon: TrendingUp,
                color: "text-blue-600",
              },
              {
                label: "Отправлено ответов",
                value: stats.submitted,
                icon: TrendingUp,
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
                color:
                  stats.approvalRate >= 80
                    ? "text-green-600"
                    : stats.approvalRate >= 50
                    ? "text-orange-500"
                    : "text-red-500",
              },
              {
                label: "Среднее время",
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
                    <p className="text-xs text-muted-foreground leading-tight">
                      {label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Logs */}
        <Card className="flex flex-col" style={{ maxHeight: "75vh" }}>
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
                      <p className="text-sm">
                        {ACTION_LABELS[l.action] || l.action}
                      </p>
                      {l.details && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {l.details}
                        </p>
                      )}
                      {l.timeSpentMinutes != null && (
                        <p className="text-xs text-muted-foreground">
                          Время: {l.timeSpentMinutes} мин
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDate(l.createdAt)}
                    </p>
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
