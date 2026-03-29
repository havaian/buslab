"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Users, GraduationCap } from "lucide-react";
import { usersApi, type CitizenUser } from "@/lib/api";
import { BottomNav } from "../../_components/bottom-nav";
import { MobileHeader } from "../../_components/mobile-header";
import { getUserDisplayName } from "@/lib/utils";

const NAV = [
  { href: "/app/admin", label: "Обращения", icon: FileText },
  { href: "/app/admin/users", label: "Граждане", icon: Users },
  { href: "/app/admin/students", label: "Студенты", icon: GraduationCap },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<CitizenUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ search, page, limit: 20 });
      setUsers(res.users ?? []);
      setTotal(res.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      <MobileHeader title="Граждане" />

      <div className="px-3 py-2 border-b">
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
            placeholder="Имя, username..."
            className="w-full rounded-lg border bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 px-3 py-3 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Загрузка...
          </p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Нет пользователей
          </p>
        ) : (
          users.map((u) => (
            <button
              key={u._id}
              onClick={() => router.push(`/users/${u._id}`)}
              className="w-full text-left rounded-xl border bg-card px-4 py-3 space-y-0.5 active:opacity-70"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{getUserDisplayName(u)}</p>
                {u.isBanned && (
                  <span className="text-xs text-red-500 font-medium">
                    Заблокирован
                  </span>
                )}
              </div>
              {u.username && (
                <p className="text-xs text-muted-foreground">@{u.username}</p>
              )}
            </button>
          ))
        )}
      </div>

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
