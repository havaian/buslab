"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/layout/sidebar";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar — replaces the floating fixed hamburger */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm truncate">
            Юридическая клиника
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
