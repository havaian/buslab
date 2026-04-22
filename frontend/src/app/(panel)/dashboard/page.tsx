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
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Star,
} from "lucide-react";
import { statsApi, type DashboardStats } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PIE_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#a855f7",
  "#22c55e",
  "#ef4444",
  "#06b6d4",
];

// Исправленные ключи - совпадают с реальными статусами в БД
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

// Разделитель секций с заголовком
function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
        {title}
      </p>
      <div className="flex-1 border-t" />
    </div>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/tasks");
      return;
    }
    // Грузим дашборд сразу
    statsApi
      .dashboard()
      .then(setStats)
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
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  // dateTo должен быть следующим днём - бэк делает $lte new Date(dateTo),
  // т.е. new Date("2025-03-31") = midnight, не захватывает сегодняшние записи
  const tomorrowISO = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  // startOfWeek - совпадает с тем как считает getDashboard на бэке
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfWeekISO = startOfWeek.toISOString().slice(0, 10);

  return (
    <PageShell title="Дашборд">
      {/* ── Обращения ───────────────────────────────────────────────────────── */}
      <SectionLabel title="Обращения" />
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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

      {/* ── За период ───────────────────────────────────────────────────────── */}
      <SectionLabel title="За период" />
      <div className="grid grid-cols-3 gap-3 mb-6">
        <PeriodCard
          label="За сегодня"
          value={stats.periods.today}
          onClick={() =>
            router.push(`/requests?dateFrom=${todayISO}&dateTo=${tomorrowISO}`)
          }
        />
        <PeriodCard
          label="За неделю"
          value={stats.periods.week}
          onClick={() => router.push(`/requests?dateFrom=${startOfWeekISO}`)}
        />
        <Card
          className="cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => router.push("/students?status=active")}
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

      {/* ── Графики ─────────────────────────────────────────────────────────── */}
      <SectionLabel title="Графики" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
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

      {/* ── Оценки граждан ──────────────────────────────────────────────── */}
      {stats.ratings.count > 0 && (
        <>
          <SectionLabel title="Оценки от граждан" />

          {/* Карточки */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Card className="border-yellow-400/40 bg-yellow-400/5">
              <CardContent className="flex items-center gap-3 pt-5 pb-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-yellow-400/15">
                  <Star size={16} className="fill-yellow-400 text-yellow-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold">
                    {stats.ratings.avg !== null
                      ? stats.ratings.avg.toFixed(1)
                      : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Средняя оценка
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-5 pb-5">
                <div className="rounded-lg p-2.5 shrink-0 bg-blue-500">
                  <CheckCircle size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold">{stats.ratings.count}</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Всего оценок
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-5 pb-5">
                <div className="rounded-lg p-2.5 shrink-0 bg-green-500">
                  <FileText size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold">
                    {stats.ratings.ratedShare}%
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Закрытых с оценкой
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Распределение + Топ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Распределение оценок</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={stats.ratings.distribution}
                    margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                  >
                    <XAxis
                      dataKey="star"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${v}⭐`}
                    />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(l) => `${l} звёзд`}
                      formatter={(v: number) => [v, "Оценок"]}
                    />
                    <Bar
                      dataKey="count"
                      fill="#f59e0b"
                      radius={[2, 2, 0, 0]}
                      name="Оценок"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Топ студентов{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (мин. 3 оценки)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {stats.ratings.top.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-4 py-3">
                    Пока недостаточно данных. Нужно не менее 3 оценок.
                  </p>
                ) : (
                  <div className="divide-y">
                    {stats.ratings.top.map((s, i) => (
                      <button
                        key={s._id}
                        onClick={() => router.push(`/students/${s._id}`)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="text-xs text-muted-foreground shrink-0 w-4">
                          {i + 1}.
                        </span>
                        <span className="text-sm truncate flex-1">
                          {`${s.firstName} ${s.lastName}`.trim() ||
                            s.username ||
                            s._id.slice(-6)}
                        </span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              size={10}
                              className={
                                n <= Math.round(s.avg)
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-muted-foreground/30"
                              }
                            />
                          ))}
                        </span>
                        <span className="text-sm font-semibold shrink-0 w-10 text-right">
                          {s.avg.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({s.count})
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── Студенты ────────────────────────────────────────────────────────── */}
      {(stats.users.byUniversity.length > 0 ||
        stats.users.byFaculty.length > 0 ||
        stats.users.byCourse.length > 0) && (
        <>
          <SectionLabel title="Студенты" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">По университетам</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {stats.users.byUniversity.map((u) => (
                    <button
                      key={u._id}
                      onClick={() =>
                        router.push(`/students?university=${u._id}`)
                      }
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className="text-sm truncate">{u.name}</span>
                      <span className="text-sm font-semibold shrink-0 ml-2">
                        {u.count}
                      </span>
                    </button>
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
                    <button
                      key={f._id}
                      onClick={() => router.push(`/students?faculty=${f._id}`)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className="text-sm truncate">{f.name}</span>
                      <span className="text-sm font-semibold shrink-0 ml-2">
                        {f.count}
                      </span>
                    </button>
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
                    <button
                      key={c.course}
                      onClick={() =>
                        router.push(`/students?course=${c.course}`)
                      }
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <span className="text-sm">{c.course} курс</span>
                      <span className="text-sm font-semibold">{c.count}</span>
                    </button>
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
        </>
      )}
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
