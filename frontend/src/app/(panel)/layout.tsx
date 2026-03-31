"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [isMiniApp, setIsMiniApp] = useState(false);

  useEffect(() => {
    setIsMiniApp(!!(window as any).Telegram?.WebApp?.initData);
  }, []);

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

  const isCitizen = user.role === "user";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — hidden for citizen, hidden on mobile for all */}
      <Sidebar
        role={user.role}
        firstName={user.firstName}
        lastName={user.lastName}
        logout={logout}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/*
          ── Mini App header (admin + student) ────────────────────────────────
          Логотип + название по центру.
          padding-top компенсирует нативный Telegram overlay (кнопка закрытия,
          бургер) в fullscreen-режиме через --tg-content-safe-area-inset-top.
          В non-fullscreen режиме переменная = 0, показывается обычная полоска.
        */}
        {isMiniApp && !isCitizen && (
          <div
            className="flex shrink-0 items-center justify-center gap-2 border-b bg-background lg:hidden"
            style={{
              paddingTop:
                "var(--tg-content-safe-area-inset-top, env(safe-area-inset-top))",
              height:
                "calc(3.5rem + var(--tg-content-safe-area-inset-top, env(safe-area-inset-top)))",
            }}
          >
            <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
            <span className="font-semibold text-sm">Юридическая клиника</span>
          </div>
        )}

        {/*
          ── Regular mobile top bar (NOT Mini App) ─────────────────────────────
          Логотип слева — стандартный хедер для обычного браузера на мобильном.
        */}
        {!isCitizen && !isMiniApp && (
          <div
            className="flex shrink-0 items-center gap-3 border-b px-4 lg:hidden"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              height: "calc(3.5rem + env(safe-area-inset-top))",
            }}
          >
            <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
            <span className="font-semibold text-sm truncate">
              Юридическая клиника
            </span>
          </div>
        )}

        {/* Main content */}
        <div
          className="flex-1 overflow-y-auto lg:pb-0"
          style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>

      {/* Mobile bottom nav — all roles */}
      <BottomNav role={user.role} />
    </div>
  );
}
