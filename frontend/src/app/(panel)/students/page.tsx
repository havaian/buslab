"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  statsApi,
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
import { Suspense } from "react";

const STATUS_OPTS = [
  { value: "_all", label: "Все" },
  { value: "active", label: "В работе" },
  { value: "free", label: "Свободны" },
  { value: "overdue", label: "Просрочены" },
];

type SortKey = "approved" | "submitted" | "approvalRate" | "avgTime";
type SortDir = "desc" | "asc";

const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: "approved", label: "По одобренным" },
  { value: "submitted", label: "По ответам" },
  { value: "approvalRate", label: "По % одобрения" },
  { value: "avgTime", label: "По среднему времени" },
];

function StudentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [all, setAll] = useState<StudentSummary[]>([]);
  const [unis, setUnis] = useState<UniversityWithFaculties[]>([]);
  const [loading, setLoading] = useState(true);

  const [university, setUniversity] = useState(
  () => searchParams.get("university") || "_all"
  );
  const [faculty, setFaculty] = useState(
    () => searchParams.get("faculty") || "_all"
  );
  const [course, setCourse] = useState(
    () => searchParams.get("course") || "_all"
  );
  const [status, setStatus] = useState(
    () => searchParams.get("status") || "_all"
  );
  const [sortKey, setSortKey] = useState<SortKey>("approved");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const selectedUni = unis.find((u) => u._id === university);

  useEffect(() => {
    Promise.all([statsApi.students(), universitiesApi.list()])
      .then(([s, u]) => {
        setAll(s);
        setUnis(u);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = [...all];

    if (status !== "_all") {
      result = result.filter((s) => s.currentStatus === status);
    }

    // university/faculty/course - поля могут быть не в StudentSummary,
    // пропускаем если не заполнены (они есть только в полном User объекте)
    // Оставляем для будущего расширения бэкенда

    result.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === "desc"
        ? (bv as number) - (av as number)
        : (av as number) - (bv as number);
    });

    return result;
  }, [all, status, sortKey, sortDir]);

  const toggleDir = () => setSortDir((d) => (d === "desc" ? "asc" : "desc"));

  return (
    <PageShell
      title="Студенты"
      description={`${filtered.length} из ${all.length}`}
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 text-sm w-[150px]">
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

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-9 text-sm w-[190px]">
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

        {/* Sort direction toggle */}
        <button
          onClick={toggleDir}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          title={sortDir === "desc" ? "По убыванию" : "По возрастанию"}
        >
          {sortDir === "desc" ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
          {sortDir === "desc" ? "По убыванию" : "По возрастанию"}
        </button>
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
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Нет данных
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
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
                        {s.avgTime ? `${s.avgTime} мин` : "-"}
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
