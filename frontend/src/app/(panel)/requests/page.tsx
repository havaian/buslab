"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
  requestsApi,
  categoriesApi,
  type Request,
  type Category,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timer } from "@/components/shared/timer";
import { formatDate, getCategoryName, getUserDisplayName } from "@/lib/utils";

const STATUSES = [
  { value: "_all", label: "Все статусы" },
  { value: "pending", label: "Ожидает проверки" },
  { value: "approved", label: "Одобрено" },
  { value: "assigned", label: "В работе" },
  { value: "answered", label: "Ответ на проверке" },
  { value: "closed", label: "Закрыто" },
  { value: "declined", label: "Отклонено" },
];

const LIMITS = [10, 25, 50, 100];

function RequestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Инициализируем из URL params (для навигации с дашборда)
  const [requests, setRequests] = useState<Request[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(
    () => searchParams.get("status") || "_all"
  );
  const [categoryId, setCategoryId] = useState("_all");
  const [dateFrom, setDateFrom] = useState(
    () => searchParams.get("dateFrom") || ""
  );
  const [dateTo, setDateTo] = useState(() => searchParams.get("dateTo") || "");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestsApi.list({
        search,
        status: status === "_all" ? "" : status,
        categoryId: categoryId === "_all" ? "" : categoryId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
      });
      setRequests(res.requests ?? []);
      setTotal(res.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, status, categoryId, dateFrom, dateTo, page, limit]);

  useEffect(() => {
    categoriesApi
      .list()
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <PageShell title="Обращения" description={`${total} записей`}>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 text-sm w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryId}
          onValueChange={(v) => {
            setCategoryId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 text-sm w-[160px]">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Все категории</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="h-9 text-sm w-[140px]"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          placeholder="С"
        />
        <Input
          type="date"
          className="h-9 text-sm w-[140px]"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          placeholder="По"
        />

        <Select
          value={String(limit)}
          onValueChange={(v) => {
            setLimit(Number(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 text-sm w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMITS.map((l) => (
              <SelectItem key={l} value={String(l)}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">ID</th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    Пользователь
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">
                    Категория
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Текст</th>
                  <th className="px-4 py-2.5 text-left font-medium">Статус</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">
                    Таймер
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">
                    Дата
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium hidden xl:table-cell">
                    Студент
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Загрузка...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Нет обращений
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr
                      key={r._id}
                      className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                      onClick={() => router.push(`/requests/${r._id}`)}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        #{r._id.slice(-6)}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.userId && typeof r.userId === "object" ? (
                          <div>
                            <span className="font-medium">
                              {getUserDisplayName(r.userId)}
                            </span>
                            {r.userId.username && (
                              <span className="text-muted-foreground text-xs block">
                                @{r.userId.username}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">
                        {getCategoryName(r.categoryId)}
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        <span className="line-clamp-1 text-sm">{r.text}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        {r.status === "assigned" ? (
                          <Timer deadline={r.timerDeadline} />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-sm hidden xl:table-cell">
                        {r.studentId && typeof r.studentId === "object" ? (
                          getUserDisplayName(r.studentId)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
            Страница {page} из {totalPages} · {total} записей
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default function RequestsPage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Обращения">
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </PageShell>
      }
    >
      <RequestsPageContent />
    </Suspense>
  );
}
