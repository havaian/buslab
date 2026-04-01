import { useEffect, useState } from "react";

/**
 * Читает отступы из Telegram Mini App SDK напрямую через JS.
 * Работает на всех версиях Telegram где есть WebApp API.
 *
 * top  - высота нативного overlay Telegram (кнопки Close, бургер)
 * bottom - высота нативных кнопок телефона (домой, назад, последние приложения)
 *
 * В top уже зашит дополнительный буфер EXTRA_TOP_PX — чтобы layout не делал
 * никаких вычислений и просто использовал значение напрямую.
 */

// Дополнительный отступ поверх значения SDK.
// Нужен потому что contentSafeAreaInset.top на части устройств/версий
// возвращает 0 или заниженное значение, а нативный тулбар Telegram всё равно есть.
const EXTRA_TOP_PX = 52;

export function useTgSafeArea() {
  const [top, setTop] = useState(0);
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    const update = () => {
      // contentSafeAreaInset.top - высота Telegram overlay (Bot API 8.0+)
      const contentTop = tg.contentSafeAreaInset?.top ?? 0;
      // safeAreaInset.top - системный safe area (Bot API 7.10+), fallback
      const safeTop = tg.safeAreaInset?.top ?? 0;
      // Берём максимум из двух источников + фиксированный буфер
      setTop(Math.max(contentTop, safeTop) + EXTRA_TOP_PX);

      // safeAreaInset.bottom - нативные кнопки телефона (Bot API 7.10+)
      const safeBottom = tg.safeAreaInset?.bottom ?? 0;
      setBottom(safeBottom);
    };

    update();

    // Подписываемся на изменения (например при повороте экрана)
    tg.onEvent?.("contentSafeAreaChanged", update);
    tg.onEvent?.("safeAreaChanged", update);

    return () => {
      tg.offEvent?.("contentSafeAreaChanged", update);
      tg.offEvent?.("safeAreaChanged", update);
    };
  }, []);

  return { top, bottom };
}
