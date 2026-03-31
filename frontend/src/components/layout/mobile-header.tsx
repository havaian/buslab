"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title: string;
  back?: boolean | string;
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

  // В Telegram Mini App нативный UI (кнопка закрытия, бургер) перекрывает
  // верхнюю часть экрана. Используем CSS переменную --tg-content-safe-area-inset-top
  // которую Telegram SDK выставляет автоматически (Bot API 7.10+).
  // Fallback: env(safe-area-inset-top) для устройств с челкой.
  const [isMiniApp, setIsMiniApp] = useState(false);

  useEffect(() => {
    setIsMiniApp(!!(window as any).Telegram?.WebApp?.initData);
  }, []);

  const handleBack = () => {
    if (typeof back === "string") router.push(back);
    else router.back();
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex flex-col border-b bg-background px-3",
        className
      )}
      style={
        isMiniApp
          ? {
              paddingTop:
                "var(--tg-content-safe-area-inset-top, env(safe-area-inset-top))",
            }
          : undefined
      }
    >
      <div className="flex h-12 items-center gap-2">
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
      </div>
    </header>
  );
}
