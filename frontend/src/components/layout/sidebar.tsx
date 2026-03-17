"use client";

import { useState } from "react";
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
  Menu,
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

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const nav = user?.role === "admin" ? adminNav : studentNav;
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger — fixed top-left, only on small screens */}
      <button
        className="fixed left-0 top-0 z-50 flex h-14 w-14 items-center justify-center text-muted-foreground hover:text-foreground lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Открыть меню"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "flex h-screen w-56 shrink-0 flex-col border-r bg-card",
          // Desktop: always in flow
          "lg:static lg:translate-x-0 lg:z-auto",
          // Mobile: fixed overlay, slide in/out
          "fixed left-0 top-0 z-40 transition-transform duration-200 lg:transition-none",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo + close button (mobile) */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="font-semibold text-sm leading-tight">
            Юридическая клиника
          </span>
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground p-1"
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
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

        {/* User info + logout */}
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
