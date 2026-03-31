"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useTgSafeArea } from "@/hooks/use-tg-safe-area";

// Высота BottomNav (h-16 = 4rem = 64px)
const BOTTOM_NAV_H = 64;

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { top: tgTop, bottom: tgBottom } = useTgSafeArea();

  const isMiniApp = tgTop > 0 || tgBottom > 0;

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
          Логотип по центру.
        */}
        {isMiniApp && (
          <div
            className="flex shrink-0 items-center justify-center gap-2 border-b bg-background lg:hidden"
            style={{
              paddingTop: tgTop,
              height: 56 + tgTop,
            }}
          >
            <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
            <span className="font-semibold text-sm">Юридическая клиника</span>
          </div>
        )}

        {/* Обычный браузер */}
        {!isMiniApp && (
          <div
            className="flex shrink-0 items-center gap-3 border-b px-4 lg:hidden"
            style={{ height: 56 }}
          >
            <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
            <span className="font-semibold text-sm truncate">
              Юридическая клиника
            </span>
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