"use client";

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

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <span className="font-semibold text-sm leading-tight">
          Юридическая клиника
        </span>
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
  );
}
