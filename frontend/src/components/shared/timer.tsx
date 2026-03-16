"use client";

import { useEffect, useState } from "react";
import { formatTimer, getTimerMs, getTimerColor } from "@/lib/utils";

export function Timer({ deadline }: { deadline: string | null }) {
  const [ms, setMs] = useState(() => getTimerMs(deadline));

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setMs(getTimerMs(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline)
    return <span className="text-muted-foreground text-sm">—</span>;

  return (
    <span className={`font-mono text-sm font-semibold ${getTimerColor(ms)}`}>
      {formatTimer(ms)}
    </span>
  );
}
