"use client";

import { useEffect, useState } from "react";
import { ClipboardList, History, User } from "lucide-react";
import { adminUsersApi, type StudentStats } from "@/lib/api";
import { BottomNav } from "../../../_components/bottom-nav";
import { MobileHeader } from "../../../_components/mobile-header";
import { useMiniApp } from "../../../miniapp-context";

const NAV = [
  { href: "/app/student", label: "Задание", icon: ClipboardList },
  { href: "/app/student/history", label: "История", icon: History },
  { href: "/app/student/profile", label: "Профиль", icon: User },
];

export default function StudentProfilePage() {
  const { user } = useMiniApp();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminUsersApi
      .myStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      <MobileHeader title="Профиль" />

      <div className="px-4 py-6 space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">
              {user?.firstName?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="text-center">
            <p className="font-semibold">
              {user?.firstName} {user?.lastName}
            </p>
            {user?.username && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center">
            Загрузка...
          </p>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Всего заданий", stats.total],
                ["Одобрено", stats.approved],
                ["Отклонено", stats.rejected],
                ["Отказов", stats.declines],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border bg-card px-4 py-3 text-center"
                >
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-card divide-y">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Одобрений</span>
                <span className="text-sm font-medium">
                  {stats.approvalRate}%
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Среднее время
                </span>
                <span className="text-sm font-medium">
                  {stats.avgTime ? `${Math.round(stats.avgTime)} мин` : "—"}
                </span>
              </div>
              {stats.rating !== null && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">Рейтинг</span>
                  <span className="text-sm font-medium">#{stats.rating}</span>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      <BottomNav items={NAV} />
    </div>
  );
}
