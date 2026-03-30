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

interface TelegramLoginOptions {
  client_id: string | number;
  request_access?: ("phone" | "write")[];
  lang?: string;
}

type TelegramCallback = (result: {
  id_token?: string;
  user?: Record<string, unknown>;
  error?: string;
}) => void;

export default function LoginPage() {
  const { login, loading, user } = useAuth();
  const dialog = useDialog();
  const containerRef = useRef<HTMLDivElement>(null);
  const initDone = useRef(false);

  useEffect(() => {
    // Don't mount login widget while auth is still being checked
    if (loading || user) return;
    if (initDone.current) return;
    initDone.current = true;

    const clientId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_CLIENT_ID;
    if (!clientId) {
      console.error("NEXT_PUBLIC_TELEGRAM_BOT_CLIENT_ID is not set");
      return;
    }

    const handleAuth: TelegramCallback = async (result) => {
      if (result.error || !result.id_token) {
        dialog.alert(result.error || "Не получен токен авторизации", {
          title: "Ошибка",
          variant: "destructive",
        });
        return;
      }
      try {
        await login(result.id_token);
      } catch (e: unknown) {
        dialog.alert((e as Error).message || "Ошибка входа", {
          title: "Ошибка",
          variant: "destructive",
        });
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-login.js";
    script.async = true;
    script.onload = () => {
      if (!window.Telegram?.Login || !containerRef.current) return;

      window.Telegram.Login.init(
        { client_id: clientId, lang: "ru" },
        handleAuth
      );

      const btn = document.createElement("button");
      btn.className =
        "flex items-center justify-center gap-2 w-full rounded-md bg-[#2AABEE] hover:bg-[#229ED9] text-white font-medium py-2.5 px-4 text-sm transition-colors cursor-pointer";
      btn.innerHTML =
        `<svg width="20" height="20" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="120" cy="120" r="120" fill="white" fill-opacity="0.2"/>
          <path d="M175 65L52 113c-8 3-8 8-1 10l31 10 12 37c2 5 3 7 7 7s5-2 8-5l16-16 33 24c6 4 10 2 12-5l21-101c2-9-3-13-11-9z" fill="white"/>
        </svg>` + "Войти через Telegram";
      btn.onclick = () => window.Telegram?.Login.open();
      containerRef.current.appendChild(btn);
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, [login, dialog, loading, user]);

  // While auth context is initialising — show spinner so login form never briefly flashes
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

  // Already authenticated — auth context will redirect, render nothing
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
          <div ref={containerRef} className="w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
