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
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const dialog = useDialog();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.onTelegramAuth = async (userData) => {
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
    script.setAttribute(
      "data-telegram-login",
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || ""
    );
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;

    containerRef.current?.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
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
          <div ref={containerRef} />
        </CardContent>
      </Card>
    </div>
  );
}
