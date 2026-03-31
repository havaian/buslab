"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { authApi, type PanelUser } from "@/lib/api";

interface AuthContextValue {
  user: PanelUser | null;
  loading: boolean;
  login: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// "/" исключён — root page.tsx показывает spinner, auth-context сам редиректит
const isPanelAuthExcluded = (pathname: string) =>
  pathname === "/" ||
  pathname === "/login" ||
  pathname === "/privacy" ||
  pathname.startsWith("/user") ||
  pathname === "/auth/done";

function loadTelegramWebAppSdk(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).Telegram?.WebApp?.initData !== undefined) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      'script[src="https://telegram.org/js/telegram-web-app.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PanelUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Цель редиректа после auth — навигация происходит в отдельном useEffect
  // ПОСЛЕ того как React закоммитил обновления user + loading.
  // Это исключает race condition когда panel layout монтируется с user=null.
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  }, [router]);

  const redirectByRole = useCallback((role: string): string => {
    if (role === "admin") return "/dashboard";
    if (role === "student") return "/tasks";
    return "/user";
  }, []);

  // ── Фаза 2: навигация происходит здесь, уже после render с актуальным state ──
  useEffect(() => {
    if (!loading && user && pendingRedirect) {
      setPendingRedirect(null);
      router.push(pendingRedirect);
    }
  }, [loading, user, pendingRedirect, router]);

  // ── Фаза 1: аутентификация ─────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      await loadTelegramWebAppSdk();

      const twa = (window as any).Telegram?.WebApp;

      if (twa?.initData) {
        twa.ready();
        twa.expand();
        try {
          const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
          const res = await fetch(`${apiBase}/miniapp/auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: twa.initData }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Auth failed");

          localStorage.setItem("token", data.access_token);

          // Вычисляем цель навигации
          const startParam = twa.initDataUnsafe?.start_param;
          let target: string | null = null;

          if (startParam) {
            const decoded = decodeURIComponent(startParam);
            const role = data.user.role as string;

            if (decoded.startsWith("r_")) {
              const requestId = decoded.slice(2);
              target =
                role === "user"
                  ? `/user/${requestId}`
                  : `/requests/${requestId}`;
            } else if (decoded.startsWith("take_")) {
              target = `/tasks?take=${decoded.slice(5)}`;
            } else if (decoded === "tasks") {
              target = "/tasks";
            } else if (decoded === "history") {
              target = "/history";
            }
          }

          if (!target && (pathname === "/login" || pathname === "/")) {
            target = redirectByRole(data.user.role);
          }

          // Сначала выставляем state — React закоммитит их в одном render.
          // Только ПОСЛЕ этого (в фазе 2) произойдёт router.push.
          setUser(data.user);
          setLoading(false);
          if (target) setPendingRedirect(target);
        } catch {
          // initData auth failed — fallback на stored token
          const token = localStorage.getItem("token");
          if (!token) {
            setLoading(false);
            if (!isPanelAuthExcluded(pathname)) router.push("/login");
          } else {
            try {
              const u = await authApi.me();
              setUser(u);
            } catch {
              localStorage.removeItem("token");
              if (!isPanelAuthExcluded(pathname)) router.push("/login");
            } finally {
              setLoading(false);
            }
          }
        }
        return;
      }

      // Обычный браузер — проверяем stored token
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        if (!isPanelAuthExcluded(pathname)) router.push("/login");
        return;
      }

      try {
        const u = await authApi.me();
        setUser(u);
        if (pathname === "/login" || pathname === "/") {
          setPendingRedirect(redirectByRole(u.role));
        }
      } catch {
        localStorage.removeItem("token");
        if (!isPanelAuthExcluded(pathname)) router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (idToken: string) => {
      const res = await authApi.telegramLogin(idToken);
      localStorage.setItem("token", res.access_token);
      setUser(res.user);
      router.push(redirectByRole(res.user.role));
    },
    [redirectByRole, router]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
