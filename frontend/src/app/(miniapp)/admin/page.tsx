"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Users,
  GraduationCap,
  LayoutDashboard,
} from "lucide-react";
import {
  requestsApi,
  categoriesApi,
  type Request,
  type Category,
} from "@/lib/api";
import { BottomNav } from "../_components/bottom-nav";
import { MobileHeader } from "../_components/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  formatDateShort,
  getCategoryName,
  getUserDisplayName,
} from "@/lib/utils";

const NAV = [
  { href: "/app/admin", label: "Обращения", icon: FileText },
  { href: "/app/admin/users", label: "Граждане", icon: Users },
  { href: "/app/admin/students", label: "Студенты", icon: GraduationCap },
];

const STATUSES = [
  { value: "", label: "Все" },
  { value: "pending", label: "Ожидает" },
  { value: "approved", label: "Одобрено" },
  { value: "assigned", label: "В работе" },
  { value: "answered", label: "На проверке" },
  { value: "closed", label: "Закрыто" },
  { value: "declined", label: "Отклонено" },
];

export default function AdminRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestsApi.list({ search, status, page, limit: 20 });
      setRequests(res.requests ?? []);
      setTotal(res.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    categoriesApi.list().then(setCategories);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      <MobileHeader title="Обращения" />

      {/* Search + status filter */}
      <div className="px-3 py-2 space-y-2 border-b">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Поиск..."
            className="w-full rounded-lg border bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setStatus(s.value);
                setPage(1);
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                status === s.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-3 py-3 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Загрузка...
          </p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Нет обращений
          </p>
        ) : (
          requests.map((r) => (
            <button
              key={r._id}
              onClick={() => router.push(`/app/admin/requests/${r._id}`)}
              className="w-full text-left rounded-xl border bg-card px-4 py-3 space-y-1.5 active:opacity-70"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDateShort(r.createdAt)}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {getCategoryName(r.categoryId)}
                </span>
                {r.userId && typeof r.userId === "object" && (
                  <span className="text-xs text-muted-foreground">
                    {getUserDisplayName(r.userId)}
                  </span>
                )}
              </div>
              <p className="text-sm line-clamp-2">{r.text}</p>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm text-primary disabled:opacity-40"
          >
            ← Назад
          </button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm text-primary disabled:opacity-40"
          >
            Вперёд →
          </button>
        </div>
      )}

      <BottomNav items={NAV} />
    </div>
  );
}
