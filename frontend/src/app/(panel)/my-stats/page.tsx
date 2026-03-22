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
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [logs, setLogs] = useState<StudentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminUsersApi.myStats(), adminUsersApi.myLogs()])
      .then(([s, l]) => {
        setStats(s);
        setLogs(l);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <PageShell title="Моя статистика">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  return (
    <PageShell title="Моя статистика">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          {/* Rating */}
          {stats.rating !== null && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-4 pt-5 pb-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-2xl font-bold text-primary">
                    {stats.rating}%
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-lg">Рейтинг</p>
                  <p className="text-xs text-muted-foreground">
                    На основе процента одобрения
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["Всего взято", stats.total, TrendingUp, "text-blue-600"],
                ["Одобрено", stats.approved, CheckCircle, "text-green-600"],
                ["Отклонено", stats.rejected, XCircle, "text-red-500"],
                [
                  "Среднее время",
                  stats.avgTime ? `${stats.avgTime} мин` : "—",
                  Clock,
                  "text-orange-500",
                ],
                ["Просрочек", stats.expired, AlertTriangle, "text-red-500"],
                ["Отказов", stats.declines, XCircle, "text-muted-foreground"],
              ] as [string, string | number, any, string][]
            ).map(([label, value, Icon, color]) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <Icon size={18} className={`${color} shrink-0`} />
                  <div>
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Action log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Журнал действий</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Нет записей
              </p>
            ) : (
              <div className="divide-y max-h-[500px] overflow-y-auto">
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
