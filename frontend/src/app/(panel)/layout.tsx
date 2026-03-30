"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Загрузка...
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
        {/* Mobile top bar — admin and student only, citizen pages have their own headers */}
        {!isCitizen && (
          <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden">
            <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
            <span className="font-semibold text-sm truncate">
              Юридическая клиника
            </span>
          </div>
        )}

        {/* Main content — add bottom padding on mobile so content isn't hidden behind nav */}
        <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</div>
      </div>

      {/* Mobile bottom nav — all roles */}
      <BottomNav role={user.role} />
    </div>
  );
}
