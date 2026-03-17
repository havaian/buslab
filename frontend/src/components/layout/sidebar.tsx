"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  GraduationCap,
  Tag,
  HelpCircle,
  ClipboardList,
  History,
  BarChart2,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const adminNav = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/requests", label: "Обращения", icon: FileText },
  { href: "/users", label: "Пользователи", icon: Users },
  { href: "/students", label: "Студенты", icon: GraduationCap },
  { href: "/categories", label: "Категории", icon: Tag },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
];

const studentNav = [
  { href: "/tasks", label: "Задания", icon: ClipboardList },
  { href: "/history", label: "История", icon: History },
  { href: "/my-stats", label: "Статистика", icon: BarChart2 },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const nav = user?.role === "admin" ? adminNav : studentNav;

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-screen w-56 shrink-0 flex-col border-r bg-card",
          // Desktop: always visible, static
          "lg:static lg:translate-x-0 lg:z-auto",
          // Mobile: fixed, slides in/out
          "fixed left-0 top-0 z-40 transition-transform duration-200 lg:transition-none",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo + mobile close */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="font-semibold text-sm leading-tight">
            Юридическая клиника
          </span>
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground p-1"
            onClick={onClose}
            aria-label="Закрыть меню"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-accent",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t p-4">
          {user && (
            <div className="mb-3">
              <p className="text-xs font-medium truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {user.role === "admin" ? "Администратор" : "Студент"}
              </p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut size={14} />
            Выйти
          </button>
        </div>
      </aside>
    </>
  );
}
