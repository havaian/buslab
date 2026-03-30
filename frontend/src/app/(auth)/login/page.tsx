"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useDialog } from "@/components/ui/dialog-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function LoginPage() {
  const { login, loading, user } = useAuth();
  const dialog = useDialog();
  const containerRef = useRef<HTMLDivElement>(null);
  const initDone = useRef(false);

  useEffect(() => {
    if (loading || user) return;
    if (initDone.current) return;
    initDone.current = true;

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME;
    if (!botUsername || !containerRef.current) return;

    // Global callback — Telegram widget calls this after user confirms login.
    // We forward raw widget data to the backend via POST, backend verifies hash.
    (window as any).onTelegramAuth = async (
      widgetData: Record<string, unknown>
    ) => {
      try {
        const res = await fetch(`${API_BASE}/auth/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(widgetData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Ошибка авторизации");
        await login(data.access_token, data.user);
      } catch (e: unknown) {
        dialog.alert((e as Error).message || "Ошибка входа", {
          title: "Ошибка",
          variant: "destructive",
        });
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [login, dialog, loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.svg" alt="Логотип" className="h-10 w-10 opacity-70" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center items-center">
          <img src="/logo.svg" alt="Логотип" className="h-12 w-12 mb-2" />
          <CardTitle>Юридическая клиника</CardTitle>
          <CardDescription>
            Войдите через Telegram для доступа к панели управления
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div ref={containerRef} />
        </CardContent>
      </Card>
    </div>
  );
}
