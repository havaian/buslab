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
      {/* Desktop sidebar */}
      <Sidebar
        role={user.role}
        firstName={user.firstName}
        lastName={user.lastName}
        logout={logout}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/*
          Mini App header — admin + student only.
          Логотип по центру. padding-top = высота нативного Telegram overlay
          (кнопка закрытия, бургер) в fullscreen-режиме.
          В non-fullscreen режиме --tg-content-safe-area-inset-top = 0.
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

        {/* Обычный браузер — admin + student */}
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

        {/*
          Основной контент.
          padding-bottom: 4rem (высота BottomNav) + env(safe-area-inset-bottom)
          (высота нативных кнопок телефона — домой, назад, последние приложения).
          На десктопе pb=0.
        */}
        <div
          className="flex-1 overflow-y-auto lg:pb-0"
          style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>

      <BottomNav role={user.role} />
    </div>
  );
}
