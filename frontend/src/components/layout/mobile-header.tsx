"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTgSafeArea } from "@/hooks/use-tg-safe-area";

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
  const { top } = useTgSafeArea();

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
      style={{ paddingTop: top }}
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
