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

declare global {
  interface Window {
    Telegram?: {
      Login: {
        init: (
          options: TelegramLoginOptions,
          callback: TelegramCallback
        ) => void;
        auth: (
          options: TelegramLoginOptions,
          callback: TelegramCallback
        ) => void;
        open: (callback?: TelegramCallback) => void;
      };
    };
  }
}

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
  const { login } = useAuth();
  const dialog = useDialog();
  const containerRef = useRef<HTMLDivElement>(null);
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;

    const clientId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_CLIENT_ID;
    if (!clientId) {
      console.error("NEXT_PUBLIC_TELEGRAM_BOT_CLIENT_ID is not set");
      return;
    }

    const handleAuth: TelegramCallback = async (result) => {
      if (result.error) {
        dialog.alert(result.error || "Ошибка входа", {
          title: "Ошибка",
          variant: "destructive",
        });
        return;
      }

      if (!result.id_token) {
        dialog.alert("Не получен токен авторизации", {
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
      if (!window.Telegram?.Login) return;
      window.Telegram.Login.init(
        {
          client_id: clientId,
          // No request_access: ["phone"] — only basic profile
          lang: "ru",
        },
        handleAuth
      );

      // Render button
      if (containerRef.current) {
        const btn = document.createElement("button");
        btn.className =
          "flex items-center justify-center gap-2 w-full rounded-md bg-[#2AABEE] hover:bg-[#229ED9] text-white font-medium py-2.5 px-4 text-sm transition-colors";
        btn.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="120" cy="120" r="120" fill="#2AABEE"/><path d="M175 65L52 113c-8 3-8 8-1 10l31 10 12 37c2 5 3 7 7 7s5-2 8-5l16-16 33 24c6 4 10 2 12-5l21-101c2-9-3-13-11-9z" fill="white"/></svg>' +
          "Войти через Telegram";
        btn.onclick = () => window.Telegram?.Login.open();
        containerRef.current.appendChild(btn);
      }
    };

    document.head.appendChild(script);
    initDone.current = true;

    return () => {
      document.head.removeChild(script);
    };
  }, [login, dialog]);

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
