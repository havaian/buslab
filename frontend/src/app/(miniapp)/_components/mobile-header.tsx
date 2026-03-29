"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}
("use client");

interface MobileHeaderProps {
  title: string;
  back?: boolean | string; // true = router.back(), string = specific href
  right?: React.ReactNode;
  className?: string;
}

export function MobileHeader({
  title,
  back,
  right,
  className,
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof back === "string") router.push(back);
    else router.back();
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-12 items-center gap-2 border-b bg-background px-3",
        className
      )}
    >
      {back !== undefined && (
        <button
          onClick={handleBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Назад"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <h1 className="flex-1 truncate text-sm font-semibold">{title}</h1>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="flex">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
