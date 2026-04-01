"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  statsApi,
  universitiesApi,
  type StudentSummary,
  type UniversityWithFaculties,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const STATUS_OPTS = [
  { value: "_all", label: "Все" },
  { value: "active", label: "В работе" },
  { value: "free", label: "Свободны" },
  { value: "overdue", label: "Просрочены" },
];

type SortKey = "approved" | "submitted" | "approvalRate" | "avgTime";
type SortDir = "desc" | "asc";

const STATUS_LABELS: Record<string, string> = {
  free: "Свободен",
  overdue: "Просрочен",
  busy: "Занят",
};

const STATUS_COLORS: Record<string, string> = {
  free: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  busy: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
};

function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function SortTh({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === key;
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-right font-medium cursor-pointer select-none group",
        className
      )}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {active ? (
          currentDir === "desc" ? (
            <ArrowDown size={12} className="text-primary shrink-0" />
          ) : (
            <ArrowUp size={12} className="text-primary shrink-0" />
          )
        ) : (
          <ArrowUpDown
            size={12}
            className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0"
          />
        )}
      </span>
    </th>
  );
}

function StudentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [all, setAll] = useState<StudentSummary[]>([]);
  const [unis, setUnis] = useState<UniversityWithFaculties[]>([]);
  const [loading, setLoading] = useState(true);

  // Инициализируем из searchParams — чтобы работал переход с дашборда
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
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([statsApi.students(), universitiesApi.list()])
      .then(([s, u]) => {
        setAll(s);
        setUnis(u);

        // Если пришли с дашборда с ?faculty=xxx без ?university=xxx —
        // автоматически вычисляем родительский университет по faculty _id
        const facParam = searchParams.get("faculty");
        const uniParam = searchParams.get("university");
        if (facParam && !uniParam) {
          const parentUni = u.find((uni) =>
            uni.faculties.some((f) => f._id === facParam)
          );
          if (parentUni) {
            setUniversity(parentUni._id);
          }
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Сброс страницы при смене любого фильтра
  useEffect(() => {
    setPage(1);
  }, [university, faculty, course, status, sortKey, sortDir]);

  const handleUniChange = (val: string) => {
    setUniversity(val);
    setFaculty("_all");
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const selectedUni = unis.find((u) => u._id === university);

  const filtered = useMemo(() => {
    let result = [...all];

    if (status !== "_all")
      result = result.filter((s) => s.currentStatus === status);

    if (university !== "_all")
      result = result.filter((s) => s.university === university);

    if (faculty !== "_all")
      result = result.filter((s) => s.faculty === faculty);

    if (course !== "_all")
      result = result.filter((s) => String(s.course) === course);

    result.sort((a, b) => {
      const av = (a[sortKey] ?? 0) as number;
      const bv = (b[sortKey] ?? 0) as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });

    return result;
  }, [all, university, faculty, course, status, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Счётчик: при активном фильтре — только filtered, иначе — total
  const isFiltered =
    university !== "_all" ||
    faculty !== "_all" ||
    course !== "_all" ||
    status !== "_all";
  const description = isFiltered
    ? `${filtered.length} студентов`
    : `${all.length} студентов`;

  return (
    <PageShell title="Студенты" description={description}>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 text-sm w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={university} onValueChange={handleUniChange}>
          <SelectTrigger className="h-9 text-sm w-[160px]">
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

        {/* Факультет — только если у выбранного универа есть факультеты */}
        {selectedUni && selectedUni.faculties.length > 0 && (
          <Select value={faculty} onValueChange={setFaculty}>
            <SelectTrigger className="h-9 text-sm w-[200px]">
              <SelectValue placeholder="Факультет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Все факультеты</SelectItem>
              {selectedUni.faculties.map((f) => (
                <SelectItem key={f._id} value={f._id}>
                  {f.names.ru}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Курс — только если выбран универ */}
        {selectedUni && (
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger className="h-9 text-sm w-[110px]">
              <SelectValue placeholder="Курс" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Все курсы</SelectItem>
              {(selectedUni.courses ?? [1, 2, 3, 4]).map((c) => (
                <SelectItem key={c} value={String(c)}>
                  {c} курс
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Студент</th>
                  <SortTh
                    label="Ответов"
                    sortKey="submitted"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    label="Одобрено"
                    sortKey="approved"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="px-4 py-2.5 text-right font-medium">Откл.</th>
                  <SortTh
                    label="%"
                    sortKey="approvalRate"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    label="Ср. время"
                    sortKey="avgTime"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="hidden md:table-cell"
                  />
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
                ) : paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Нет студентов
                    </td>
                  </tr>
                ) : (
                  paginated.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/students/${s.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium">
                          {truncate(
                            [s.firstName, s.lastName].filter(Boolean).join(" "),
                            28
                          )}
                        </p>
                        {s.username && (
                          <p className="text-xs text-muted-foreground">
                            @{s.username}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">{s.submitted}</td>
                      <td className="px-4 py-2.5 text-right">{s.approved}</td>
                      <td className="px-4 py-2.5 text-right">{s.rejected}</td>
                      <td className="px-4 py-2.5 text-right">
                        {s.submitted > 0 ? `${s.approvalRate}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right hidden md:table-cell">
                        {s.avgTime ? `${s.avgTime} мин` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[s.currentStatus] ?? ""
                          }`}
                        >
                          {STATUS_LABELS[s.currentStatus] ?? s.currentStatus}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">
            Страница {page} из {totalPages} · {filtered.length} студентов
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={15} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
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
