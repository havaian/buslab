"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import {
  adminUsersApi,
  universitiesApi,
  type StudentStats,
  type StudentLogEntry,
  type UniversityWithFaculties,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function MyStatsPage() {
  const { toast } = useToast();

  const [stats, setStats] = useState<StudentStats | null>(null);
  const [logs, setLogs] = useState<StudentLogEntry[]>([]);
  const [unis, setUnis] = useState<UniversityWithFaculties[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable profile state
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [course, setCourse] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, l, uniList] = await Promise.all([
        adminUsersApi.myStats(),
        adminUsersApi.myLogs(),
        universitiesApi.list(),
      ]);
      setStats(s);
      setLogs(l);
      setUnis(uniList);

      // Load current profile values
      const token = localStorage.getItem("token");
      const meRes = await fetch(`${API_BASE}/miniapp/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        setUniversity(me.university ?? "");
        setFaculty(me.faculty ?? "");
        setCourse(me.course ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedUni = unis.find((u) => u._id === university);
  const faculties = selectedUni?.faculties ?? [];
  const courses = selectedUni?.courses ?? [1, 2, 3, 4];

  const handleUniChange = (id: string) => {
    setUniversity(id);
    setFaculty("");
    setCourse("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/miniapp/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          university: university || null,
          faculty: faculty || null,
          course: course || null,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      toast("Сохранено", "success");
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка", "error");
    } finally {
      setSaving(false);
    }
  };

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

          {/* University / faculty / course */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Учебная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {/* University */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Университет
                </label>
                <div className="relative">
                  <select
                    value={university}
                    onChange={(e) => handleUniChange(e.target.value)}
                    className="w-full appearance-none rounded-lg border bg-background px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">— не указан —</option>
                    {unis.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.names.ru}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                </div>
              </div>

              {/* Faculty — only if selected university has faculties */}
              {faculties.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Факультет
                  </label>
                  <div className="relative">
                    <select
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                      className="w-full appearance-none rounded-lg border bg-background px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">— не указан —</option>
                      {faculties.map((f) => (
                        <option key={f._id} value={f._id}>
                          {f.names.ru}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    />
                  </div>
                </div>
              )}

              {/* Course */}
              {university && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Курс</label>
                  <div className="flex gap-2 flex-wrap">
                    {courses.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCourse(c === course ? "" : c)}
                        className={`h-9 w-9 rounded-lg text-sm font-medium border transition-colors ${
                          course === c
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-input text-muted-foreground hover:border-primary"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                size="sm"
                onClick={save}
                disabled={saving}
                className="w-full"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </CardContent>
          </Card>
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
