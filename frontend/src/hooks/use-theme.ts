"use client";

import { useCallback, useEffect, useState } from "react";
import { authApi } from "@/lib/api";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  // Синхронизируем состояние с тем что уже применил инлайн-скрипт
  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) ?? "light";
    setTheme(saved);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "light" ? "dark" : "light";
      localStorage.setItem("theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      // Сохраняем в БД fire-and-forget — ошибку игнорируем намеренно
      authApi.setPreferences(next).catch(() => {});
      return next;
    });
  }, []);

  return { theme, toggle };
}
