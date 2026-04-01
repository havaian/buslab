"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useTgSafeArea } from "@/hooks/use-tg-safe-area";
import { useTheme } from "@/hooks/use-theme";

// Высота BottomNav (h-16 = 4rem = 64px)
const BOTTOM_NAV_H = 64;

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  // isMiniApp теперь приходит из хука (персистируется в sessionStorage)
  // вместо вычисления tgTop > 0 — которое всегда false на первом рендере
  const { top: tgTop, bottom: tgBottom, isMiniApp } = useTgSafeArea();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.svg" alt="Логотип" className="h-10 w-10 opacity-60" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role={user.role}
        firstName={user.firstName}
        lastName={user.lastName}
        logout={logout}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/*
          Mini App header.
          paddingTop = высота Telegram overlay (JS значение из SDK).
        */}
        {isMiniApp && (
          <div
            className="flex shrink-0 items-center justify-between border-b bg-background lg:hidden px-3"
            style={{
              paddingTop: tgTop,
              height: 56 + tgTop,
            }}
          >
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
              <span className="font-semibold text-sm">Юридическая клиника</span>
            </div>
            <button
              onClick={toggle}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        )}

        {/* Обычный браузер */}
        {!isMiniApp && (
          <div
            className="flex shrink-0 items-center justify-between border-b px-4 lg:hidden"
            style={{ height: 56 }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
              <span className="font-semibold text-sm truncate">
                Юридическая клиника
              </span>
            </div>
            <button
              onClick={toggle}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        )}

        {/*
          Основной контент.
          paddingBottom = высота BottomNav + отступ нативных кнопок телефона.
          На десктопе pb=0.
        */}
        <div
          className="flex-1 overflow-y-auto lg:pb-0"
          style={{ paddingBottom: BOTTOM_NAV_H + tgBottom }}
        >
          {children}
        </div>
      </div>

      <BottomNav role={user.role} />
    </div>
  );
}
