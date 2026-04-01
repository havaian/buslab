import { useEffect, useState } from "react";

/**
 * Читает отступы из Telegram Mini App SDK напрямую через JS.
 *
 * top      - высота нативного overlay Telegram (кнопки Close, бургер)
 * bottom   - высота нативных кнопок телефона
 * isMiniApp - запущено ли внутри Telegram Mini App
 *
 * isMiniApp персистируется в sessionStorage — чтобы reload страницы
 * внутри Mini App не сбрасывал состояние до следующего тика useEffect.
 */

const SESSION_KEY = "tg_is_miniapp";
const TOP_MULTIPLIER = 1.5;
const FALLBACK_TOP_PX = 48;

export function useTgSafeArea() {
  // Инициализируем isMiniApp сразу из sessionStorage —
  // до того как useEffect запустится, чтобы первый рендер был правильным
  const [isMiniApp, setIsMiniApp] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });

  const [top, setTop] = useState(0);
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    // Сохраняем факт что мы в Mini App — переживёт reload страницы
    sessionStorage.setItem(SESSION_KEY, "1");
    setIsMiniApp(true);

    const update = () => {
      // contentSafeAreaInset.top - высота Telegram overlay (Bot API 8.0+)
      const contentTop = tg.contentSafeAreaInset?.top ?? 0;
      // safeAreaInset.top - системный safe area (Bot API 7.10+)
      const safeTop = tg.safeAreaInset?.top ?? 0;
      const rawTop = Math.max(contentTop, safeTop);
      // Если SDK вернул реальное значение — умножаем на коэффициент.
      // Если 0 (старый клиент или баг) — используем фиксированный fallback.
      setTop(
        rawTop > 0 ? Math.round(rawTop * TOP_MULTIPLIER) : FALLBACK_TOP_PX
      );

      // safeAreaInset.bottom - нативные кнопки телефона (Bot API 7.10+)
      const safeBottom = tg.safeAreaInset?.bottom ?? 0;
      setBottom(safeBottom);
    };

    update();

    tg.onEvent?.("contentSafeAreaChanged", update);
    tg.onEvent?.("safeAreaChanged", update);

    return () => {
      tg.offEvent?.("contentSafeAreaChanged", update);
      tg.offEvent?.("safeAreaChanged", update);
    };
  }, []);

  return { top, bottom, isMiniApp };
}
