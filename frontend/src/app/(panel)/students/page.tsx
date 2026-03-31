"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  adminUsersApi,
  universitiesApi,
  type StudentSummary,
  type UniversityWithFaculties,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const STATUS_OPTS = [
  { value: "_all", label: "Все" },
  { value: "active", label: "В работе" },
  { value: "free", label: "Свободны" },
  { value: "overdue", label: "Просрочены" },
  { value: "never", label: "Ни разу не брали" },
];

const SORT_OPTS = [
  { value: "createdAt", label: "По дате регистрации" },
  { value: "approved", label: "По одобренным ответам" },
];

function StudentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [unis, setUnis] = useState<UniversityWithFaculties[]>([]);
  const [loading, setLoading] = useState(true);

  const [university, setUniversity] = useState("_all");
  const [faculty, setFaculty] = useState("_all");
  const [course, setCourse] = useState("_all");
  const [status, setStatus] = useState(
    () => searchParams.get("status") || "_all"
  );
  const [sortBy, setSortBy] = useState("createdAt");

  const selectedUni = unis.find((u) => u._id === university);
  const faculties = selectedUni?.faculties ?? [];
  const courses = selectedUni?.courses ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (university !== "_all") params.university = university;
      if (faculty !== "_all") params.faculty = faculty;
      if (course !== "_all") params.course = course;
      if (status !== "_all") params.status = status;
      if (sortBy !== "createdAt") params.sortBy = sortBy;

      const query = new URLSearchParams(params).toString();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${apiBase}/admin-users/students${query ? "?" + query : ""}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [university, faculty, course, status, sortBy]);

  useEffect(() => {
    universitiesApi
      .list()
      .then(setUnis)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Сбрасываем факультет при смене универа
  const handleUniChange = (v: string) => {
    setUniversity(v);
    setFaculty("_all");
    setCourse("_all");
  };

  return (
    <PageShell title="Студенты" description={`${students.length} записей`}>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={university} onValueChange={handleUniChange}>
          <SelectTrigger className="h-9 text-sm w-[180px]">
            <SelectValue placeholder="Университет" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Все университеты</SelectItem>
            {unis.map((u) => (
              <SelectItem key={u._id} value={u._id}>
                {u.names.ru}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {faculties.length > 0 && (
          <Select value={faculty} onValueChange={setFaculty}>
            <SelectTrigger className="h-9 text-sm w-[180px]">
              <SelectValue placeholder="Факультет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Все факультеты</SelectItem>
              {faculties.map((f) => (
                <SelectItem key={f._id} value={f._id}>
                  {f.names.ru}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {courses.length > 0 && (
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger className="h-9 text-sm w-[100px]">
              <SelectValue placeholder="Курс" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Все курсы</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  {c} курс
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 text-sm w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 text-sm w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
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
                  <th className="px-4 py-2.5 text-right font-medium hidden md:table-cell">
                    Ср. время
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Загрузка...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
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
                      <td className="px-4 py-2.5 text-right text-muted-foreground hidden md:table-cell">
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

export default function StudentsPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Студенты">
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </PageShell>
      }
    >
      <StudentsContent />
    </Suspense>
  );
}
