"use client";

import { useCitizen } from "../../miniapp-context";
import { MobileHeader } from "../../_components/mobile-header";
import { BottomNav } from "../../_components/bottom-nav";
import { FileText, Plus, User } from "lucide-react";

const NAV = [
  { href: "/app/user", label: "Обращения", icon: FileText },
  { href: "/app/user/new", label: "Подать", icon: Plus },
  { href: "/app/user/profile", label: "Профиль", icon: User },
];

export default function UserProfilePage() {
  const { user } = useCitizen();

  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      <MobileHeader title="Профиль" />

      <div className="px-4 py-6 space-y-4">
        {/* Avatar placeholder */}
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

        {/* Info card */}
        <div className="rounded-xl border bg-card divide-y">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Роль</span>
            <span className="text-sm font-medium">Пользователь</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Telegram ID</span>
            <span className="text-sm font-mono">{user?.telegramId}</span>
          </div>
        </div>
      </div>

      <BottomNav items={NAV} />
    </div>
  );
}
