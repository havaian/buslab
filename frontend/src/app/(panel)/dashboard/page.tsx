"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { FileText, Clock, CheckCircle, AlertCircle, Users } from "lucide-react";
import { statsApi, type DashboardStats, type StudentSummary } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const PIE_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#a855f7",
  "#22c55e",
  "#ef4444",
  "#06b6d4",
];

// Исправленные ключи — совпадают с реальными статусами в БД
const STATUS_RU: Record<string, string> = {
  pending: "Ожидает",
  approved: "Одобрено",
  declined: "Отклонено",
  assigned: "В работе",
  answered: "На проверке",
  closed: "Закрыто",
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={
        onClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""
      }
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 pt-5 pb-5">
        <div className={`rounded-lg p-2.5 shrink-0 ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PeriodCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  return (
    <Card
      className={
        onClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""
      }
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/tasks");
      return;
    }
    Promise.all([statsApi.dashboard(), statsApi.students()])
      .then(([d, s]) => {
        setStats(d);
        setStudents(s);
      })
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading || !stats) {
    return (
      <PageShell title="Дашборд">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  const pieData = stats.charts.byStatus.map((s) => ({
    name: STATUS_RU[s._id] || s._id,
    value: s.count,
  }));

  // Вспомогательная: сегодняшняя дата в ISO для фильтров
  const todayISO = new Date().toISOString().slice(0, 10);
  const weekAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <PageShell title="Дашборд">
      {/* Main stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Всего обращений"
          value={stats.totals.total}
          icon={FileText}
          color="bg-blue-500"
          onClick={() => router.push("/requests")}
        />
        <StatCard
          label="Ожидают проверки"
          value={stats.totals.pending}
          icon={Clock}
          color="bg-yellow-500"
          onClick={() => router.push("/requests?status=pending")}
        />
        <StatCard
          label="В работе"
          value={stats.totals.inProgress}
          icon={AlertCircle}
          color="bg-purple-500"
          onClick={() => router.push("/requests?status=assigned")}
        />
        <StatCard
          label="Закрыто"
          value={stats.totals.closed}
          icon={CheckCircle}
          color="bg-green-500"
          onClick={() => router.push("/requests?status=closed")}
        />
      </div>

      {/* Period cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <PeriodCard
          label="За сегодня"
          value={stats.periods.today}
          onClick={() =>
            router.push(`/requests?dateFrom=${todayISO}&dateTo=${todayISO}`)
          }
        />
        <PeriodCard
          label="За неделю"
          value={stats.periods.week}
          onClick={() => router.push(`/requests?dateFrom=${weekAgoISO}`)}
        />
        <Card
          className="cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => router.push("/students")}
        >
          <CardContent className="flex items-center gap-2 pt-4 pb-4">
            <Users size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-tight">
                Активных студентов
              </p>
              <p className="text-2xl font-bold">{stats.activeStudents}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Обращения по дням (30 дней)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={stats.charts.byDay}
                margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
              >
                <XAxis
                  dataKey="_id"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={(l) => `Дата: ${l}`} />
                <Bar
                  dataKey="count"
                  fill="#6366f1"
                  radius={[2, 2, 0, 0]}
                  name="Обращений"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">По статусам</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* University/Faculty/Course breakdown */}
      {(stats.users.byUniversity.length > 0 ||
        stats.users.byFaculty.length > 0 ||
        stats.users.byCourse.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">По университетам</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {stats.users.byUniversity.map((u) => (
                  <div
                    key={u._id}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <span className="text-sm truncate">{u.name}</span>
                    <span className="text-sm font-semibold shrink-0 ml-2">
                      {u.count}
                    </span>
                  </div>
                ))}
                {stats.users.byUniversity.length === 0 && (
                  <p className="text-xs text-muted-foreground px-4 py-3">
                    Нет данных
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">По факультетам</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {stats.users.byFaculty.map((f) => (
                  <div
                    key={f._id}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <span className="text-sm truncate">{f.name}</span>
                    <span className="text-sm font-semibold shrink-0 ml-2">
                      {f.count}
                    </span>
                  </div>
                ))}
                {stats.users.byFaculty.length === 0 && (
                  <p className="text-xs text-muted-foreground px-4 py-3">
                    Нет данных
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">По курсам</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {stats.users.byCourse.map((c) => (
                  <div
                    key={c.course}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <span className="text-sm">{c.course} курс</span>
                    <span className="text-sm font-semibold">{c.count}</span>
                  </div>
                ))}
                {stats.users.byCourse.length === 0 && (
                  <p className="text-xs text-muted-foreground px-4 py-3">
                    Нет данных
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Students table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Сводка по студентам</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Студент</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Ответов
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Одобрено
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">Откл.</th>
                  <th className="px-4 py-2.5 text-right font-medium">%</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Ср. время
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      Нет данных
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                      onClick={() => router.push(`/students/${s.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-sm">
                          {s.firstName} {s.lastName}
                        </p>
                        {s.username && (
                          <p className="text-xs text-muted-foreground">
                            @{s.username}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">{s.submitted}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">
                        {s.approved}
                      </td>
                      <td className="px-4 py-2.5 text-right text-red-500">
                        {s.rejected}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {s.approvalRate}%
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {s.avgTime ? `${s.avgTime} мин` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.currentStatus === "free"
                              ? "bg-green-100 text-green-700"
                              : s.currentStatus === "overdue"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {s.currentStatus === "free"
                            ? "Свободен"
                            : s.currentStatus === "overdue"
                            ? "Просрочен"
                            : "Занят"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Дашборд">
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </PageShell>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
