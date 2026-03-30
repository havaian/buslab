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
    if (!botUsername) {
      console.error("NEXT_PUBLIC_TELEGRAM_BOT_NAME is not set");
      return;
    }

    // Classic Telegram Login Widget — sends {id, first_name, last_name,
    // username, photo_url, auth_date, hash} verified server-side via
    // HMAC-SHA256(SHA256(bot_token), data_check_string). No JWKS needed.
    (window as any).onTelegramAuth = async (
      userData: Record<string, unknown>
    ) => {
      try {
        await login(userData);
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

    containerRef.current?.appendChild(script);

    return () => {
      delete (window as any).onTelegramAuth;
      if (containerRef.current?.contains(script)) {
        containerRef.current.removeChild(script);
      }
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
