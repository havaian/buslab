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
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

const adminNav = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/requests", label: "Обращения", icon: FileText },
  { href: "/users", label: "Пользователи", icon: Users },
  { href: "/students", label: "Студенты", icon: GraduationCap },
  { href: "/categories", label: "Категории", icon: Tag },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/settings", label: "Настройки", icon: Settings },
];

const studentNav = [
  { href: "/tasks", label: "Задания", icon: ClipboardList },
  { href: "/history", label: "История", icon: History },
  { href: "/my-stats", label: "Статистика", icon: BarChart2 },
];

interface SidebarProps {
  role: string;
  firstName: string;
  lastName: string;
  logout: () => void;
}

export function Sidebar({ role, firstName, lastName, logout }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  // Citizen role has no sidebar - they use bottom nav only
  if (role === "user") return null;

  const nav = role === "admin" ? adminNav : studentNav;

  return (
    // Desktop only - hidden on mobile, bottom nav takes over
    <aside className="hidden lg:flex h-screen w-56 shrink-0 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <img src="/logo.svg" alt="Логотип" className="h-7 w-7 shrink-0" />
        <span className="font-semibold text-sm leading-tight truncate">
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

      {/* User + logout + theme */}
      <div className="border-t p-4">
        <div className="mb-3">
          <p className="text-xs font-medium truncate">
            {firstName} {lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            {role === "admin" ? "Администратор" : "Студент"}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut size={14} />
            Выйти
          </button>
          <button
            onClick={toggle}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
