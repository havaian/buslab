"use client";

import { useEffect, useState } from "react";
import { MiniAppContext, type MiniAppUser } from "./miniapp-context";

function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MiniAppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;

    script.onload = async () => {
      const twa = window.Telegram?.WebApp;
      if (!twa) {
        setError("Откройте приложение через Telegram.");
        setLoading(false);
        return;
      }

      twa.ready();
      twa.expand();

      const initData = twa.initData;
      if (!initData) {
        setError("initData отсутствует. Откройте приложение через Telegram.");
        setLoading(false);
        return;
      }

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
        const res = await fetch(`${apiBase}/miniapp/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Ошибка авторизации");
        }

        const data = await res.json();
        // Save to localStorage so existing api.ts helpers work unchanged
        localStorage.setItem("token", data.access_token);
        setToken(data.access_token);
        setUser(data.user);
      } catch (e: unknown) {
        setError((e as Error).message || "Ошибка авторизации");
      } finally {
        setLoading(false);
      }
    };

    script.onerror = () => {
      setError("Не удалось загрузить Telegram WebApp SDK.");
      setLoading(false);
    };

    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  return (
    <MiniAppContext.Provider value={{ user, token, loading, error }}>
      {loading ? (
        <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
          Загрузка...
        </div>
      ) : error ? (
        <div className="flex h-screen items-center justify-center px-6 text-center">
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Ошибка</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : !user ? (
        <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
          Не удалось определить пользователя
        </div>
      ) : (
        <>{children}</>
      )}
    </MiniAppContext.Provider>
  );
}

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MiniAppProvider>{children}</MiniAppProvider>;
}
