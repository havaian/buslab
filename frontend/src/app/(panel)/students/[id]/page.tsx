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
  universitiesApi,
  type StudentStats,
  type StudentLogEntry,
  type PanelUser,
  type UniversityWithFaculties,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, getUserDisplayName } from "@/lib/utils";

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

  const [student, setStudent] = useState<PanelUser | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [logs, setLogs] = useState<StudentLogEntry[]>([]);
  const [unis, setUnis] = useState<UniversityWithFaculties[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminUsersApi.studentById(id),
      adminUsersApi.studentStats(id),
      adminUsersApi.studentLogs(id),
      universitiesApi.list(),
    ])
      .then(([s, st, l, uniList]) => {
        setStudent(s);
        setStats(st);
        setLogs(l);
        setUnis(uniList);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const getUniName = (code: string | null | undefined) => {
    if (!code) return null;
    return unis.find((u) => u.code === code)?.names.ru ?? code;
  };

  const getFacName = (
    uniCode: string | null | undefined,
    facCode: string | null | undefined
  ) => {
    if (!uniCode || !facCode) return null;
    const uni = unis.find((u) => u.code === uniCode);
    return uni?.faculties.find((f) => f.code === facCode)?.names.ru ?? facCode;
  };

  if (loading || !stats) {
    return (
      <PageShell title="Студент">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={getUserDisplayName(student)}
      actions={
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={14} /> Назад
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left */}
        <div className="space-y-4">
          {student && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Информация</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Роль</span>
                  <span>Студент</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Имя</span>
                  <span className="text-right">
                    {getUserDisplayName(student)}
                  </span>
                </div>
                {student.username && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">
                      Username
                    </span>
                    <span>@{student.username}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">
                    Telegram ID
                  </span>
                  <span className="font-mono text-xs">
                    {student.telegramId}
                  </span>
                </div>
                {student.university && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">
                      Университет
                    </span>
                    <span className="text-right">
                      {getUniName(student.university)}
                    </span>
                  </div>
                )}
                {student.faculty && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">
                      Факультет
                    </span>
                    <span className="text-right text-xs">
                      {getFacName(student.university, student.faculty)}
                    </span>
                  </div>
                )}
                {student.course && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Курс</span>
                    <span>{student.course}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Статус</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      student.isBanned
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {student.isBanned ? "Заблокирован" : "Активен"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

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
                [CheckCircle, "text-blue-500", stats.total, "Всего взято"],
                [CheckCircle, "text-green-500", stats.approved, "Одобрено"],
                [
                  CheckCircle,
                  "text-purple-500",
                  stats.submitted,
                  "Отправлено ответов",
                ],
                [XCircle, "text-red-500", stats.rejected, "Отклонено"],
                [
                  Clock,
                  "text-amber-500",
                  stats.avgTime ? `${stats.avgTime} мин` : "—",
                  "Ср. время ответа",
                ],
                [AlertTriangle, "text-red-500", stats.expired, "Просрочек"],
                [XCircle, "text-orange-500", stats.declines, "Отказов"],
                [
                  CheckCircle,
                  stats.approvalRate >= 80
                    ? "text-green-500"
                    : stats.approvalRate >= 50
                    ? "text-amber-500"
                    : "text-red-500",
                  `${stats.approvalRate}%`,
                  "Процент одобрения",
                ],
              ] as [React.ElementType, string, number | string, string][]
            ).map(([Icon, color, value, label]) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 pt-4 pb-4">
                  <Icon size={18} className={`shrink-0 ${color}`} />
                  <div>
                    <p className="text-lg font-bold leading-tight">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: log */}
        <div>
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
                <div className="divide-y max-h-[600px] overflow-y-auto">
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
                        {entry.details && (
                          <p className="text-xs text-muted-foreground truncate max-w-48">
                            {entry.details}
                          </p>
                        )}
                        {entry.requestId && (
                          <button
                            className="text-xs text-primary hover:underline font-mono mt-0.5"
                            onClick={() =>
                              router.push(`/requests/${entry.requestId}`)
                            }
                          >
                            #{entry.requestId.slice(-6)}
                          </button>
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
      </div>
    </PageShell>
  );
}
