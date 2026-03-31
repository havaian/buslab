"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  GraduationCap,
  ClipboardList,
  History,
  BarChart2,
  Plus,
  User,
  Tag,
  HelpCircle,
  Settings,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTgSafeArea } from "@/hooks/use-tg-safe-area";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const adminMain: NavItem[] = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/requests", label: "Обращения", icon: FileText },
  { href: "/users", label: "Пользователи", icon: Users },
  { href: "/students", label: "Студенты", icon: GraduationCap },
];

const adminMore: NavItem[] = [
  { href: "/categories", label: "Категории", icon: Tag },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/settings", label: "Настройки", icon: Settings },
];

const studentNav: NavItem[] = [
  { href: "/tasks", label: "Задание", icon: ClipboardList },
  { href: "/history", label: "История", icon: History },
  { href: "/my-stats", label: "Статистика", icon: BarChart2 },
];

const citizenNav: NavItem[] = [
  { href: "/user", label: "Обращения", icon: FileText },
  { href: "/user/new", label: "Подать", icon: Plus },
  { href: "/user/profile", label: "Профиль", icon: User },
];

function NavLink({ href, label, icon: Icon }: NavItem) {
  const pathname = usePathname();
  const active =
    pathname === href ||
    (href !== "/user" && pathname.startsWith(href + "/")) ||
    (href === "/user" && pathname === "/user");

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
      <span className="leading-none">{label}</span>
    </Link>
  );
}

export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { bottom } = useTgSafeArea();

  const moreActive = adminMore.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden"
        style={{ paddingBottom: bottom }}
      >
        <div className="flex h-16 items-stretch">
          {role === "admin" && (
            <>
              {adminMain.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
              <button
                onClick={() => setSheetOpen(true)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  moreActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <MoreHorizontal
                  size={20}
                  strokeWidth={moreActive ? 2.5 : 1.8}
                />
                <span className="leading-none">Ещё</span>
              </button>
            </>
          )}

          {role === "student" &&
            studentNav.map((item) => <NavLink key={item.href} {...item} />)}

          {role === "user" &&
            citizenNav.map((item) => <NavLink key={item.href} {...item} />)}
        </div>
      </nav>

      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 lg:hidden"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t bg-background lg:hidden"
            style={{ paddingBottom: bottom }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold">Ещё</span>
              <button
                onClick={() => setSheetOpen(false)}
                className="p-1 text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-2 py-2">
              {adminMore.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSheetOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors",
                    pathname === href || pathname.startsWith(href + "/")
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
