"use client";

import { createContext, useContext, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MiniAppUser {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  role: "user" | "student" | "admin";
}

interface MiniAppContextValue {
  user: MiniAppUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const MiniAppContext = createContext<MiniAppContextValue>({
  user: null,
  token: null,
  loading: true,
  error: null,
});

export const useMiniApp = () => useContext(MiniAppContext);

// ── Provider ──────────────────────────────────────────────────────────────────

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
        setError(
          "Telegram WebApp SDK не доступен. Откройте приложение через Telegram."
        );
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
      {children}
    </MiniAppContext.Provider>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MiniAppProvider>
      <MiniAppGate>{children}</MiniAppGate>
    </MiniAppProvider>
  );
}

function MiniAppGate({ children }: { children: React.ReactNode }) {
  const { loading, error, user } = useMiniApp();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Ошибка</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Не удалось определить пользователя
      </div>
    );
  }

  return <>{children}</>;
}
