import { useEffect, useState } from "react";

/**
 * Читает отступы из Telegram Mini App SDK.
 *
 * top    - высота нативного overlay Telegram (кнопки Close, бургер)
 * bottom - высота нативных кнопок телефона (домой, назад, последние приложения)
 * isMiniApp - запущено ли внутри Telegram Mini App (по наличию initData)
 *
 * Порядок чтения top:
 *   1. contentSafeAreaInset.top (Bot API 8.0+) — высота именно Telegram overlay
 *   2. safeAreaInset.top (Bot API 7.10+) — системный safe area, включает и Telegram overlay
 *   3. 0 — не в Mini App или старый клиент
 *
 * isMiniApp определяется через initData, а НЕ через величину отступов —
 * это надёжнее, т.к. contentSafeAreaInset.top может быть 0 на некоторых
 * устройствах/версиях даже внутри Mini App.
 */
export function useTgSafeArea() {
  const [top, setTop] = useState(0);
  const [bottom, setBottom] = useState(0);
  const [isMiniApp, setIsMiniApp] = useState(false);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    // Определяем Mini App по наличию initData — надёжный способ
    if (tg.initData) {
      setIsMiniApp(true);
    }

    const update = () => {
      // contentSafeAreaInset.top — высота Telegram overlay (Bot API 8.0+)
      // safeAreaInset.top       — системный safe area (Bot API 7.10+), fallback
      const contentTop = tg.contentSafeAreaInset?.top ?? 0;
      const safeTop = tg.safeAreaInset?.top ?? 0;
      setTop(Math.max(contentTop, safeTop));

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
