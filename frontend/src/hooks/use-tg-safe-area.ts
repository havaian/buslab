// frontend/src/hooks/use-tg-safe-area.ts

import { useEffect, useState } from "react";

const TOP_MULTIPLIER = 1.5;
const FALLBACK_TOP_PX = 48;

export function useTgSafeArea() {
  const [top, setTop] = useState(FALLBACK_TOP_PX); // сразу fallback, не 0
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const update = () => {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg) return false;

      const contentTop = tg.contentSafeAreaInset?.top ?? 0;
      const safeTop = tg.safeAreaInset?.top ?? 0;
      const rawTop = Math.max(contentTop, safeTop);

      setTop(
        rawTop > 0 ? Math.round(rawTop * TOP_MULTIPLIER) : FALLBACK_TOP_PX
      );
      setBottom(tg.safeAreaInset?.bottom ?? 0);

      tg.onEvent?.("contentSafeAreaChanged", update);
      tg.onEvent?.("safeAreaChanged", update);

      return true;
    };

    // Первая попытка
    if (!update()) {
      // SDK ещё не готов — повторяем через 300ms
      const t = setTimeout(update, 300);
      return () => clearTimeout(t);
    }

    return () => {
      const tg = (window as any).Telegram?.WebApp;
      tg?.offEvent?.("contentSafeAreaChanged", update);
      tg?.offEvent?.("safeAreaChanged", update);
    };
  }, []);

  return { top, bottom };
}
