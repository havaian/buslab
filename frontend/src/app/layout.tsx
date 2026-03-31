import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { ToastProvider } from "@/components/ui/toast-provider";
import { DialogProvider } from "@/components/ui/dialog-provider";

export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Юридическая клиника",
  description: "Платформа управления юридической клиникой",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

// viewport-fit=cover обязателен для env(safe-area-inset-bottom/top) на iOS
// и для корректной работы с нативными кнопками телефона в Telegram Mini App
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            <DialogProvider>{children}</DialogProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
