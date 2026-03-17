"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");
  const [categoryId, setCategoryId] = useState("_all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestsApi.list({
        search,
        status: status === "_all" ? "" : status,
        categoryId: categoryId === "_all" ? "" : categoryId,
        page,
        limit,
      });
      setRequests(res.requests ?? []);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [search, status, categoryId, page, limit]);

  useEffect(() => {
    categoriesApi.list().then(setCategories);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [search, status, categoryId, limit]);

  const totalPages = Math.ceil(total / limit);

  return (
    <PageShell title="Обращения" description={`Всего: ${total}`}>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Поиск по ID, тексту, пользователю, студенту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-44">
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
        <Select
          value={String(limit)}
          onValueChange={(v) => setLimit(Number(v))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMITS.map((l) => (
              <SelectItem key={l} value={String(l)}>
                {l} / стр
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium w-20">ID</th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    Пользователь
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    Категория
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    Обращение
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Статус</th>
                  <th className="px-4 py-2.5 text-left font-medium">Таймер</th>
                  <th className="px-4 py-2.5 text-left font-medium">Дата</th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    Исполнитель
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
                      Обращений не найдено
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr
                      key={r._id}
                      onClick={() => router.push(`/requests/${r._id}`)}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {r._id.slice(-6)}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.userId && typeof r.userId === "object" ? (
                          <>
                            <span className="font-medium">
                              {getUserDisplayName(r.userId)}
                            </span>
                            {r.userId.username && (
                              <span className="text-muted-foreground text-xs ml-1">
                                @{r.userId.username}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {getCategoryName(r.categoryId)}
                      </td>
                      <td className="px-4 py-2.5 max-w-64">
                        <span className="line-clamp-1">{r.text}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        {r.status === "assigned" ? (
                          <Timer deadline={r.timerDeadline} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {r.studentId && typeof r.studentId === "object" ? (
                          getUserDisplayName(r.studentId)
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
