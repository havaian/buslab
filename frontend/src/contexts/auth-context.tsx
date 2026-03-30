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
  login: (token: string, userData: PanelUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const isPanelAuthExcluded = (pathname: string) =>
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
    script.onerror = () => resolve(); // resolve anyway, initData will just be empty
    document.head.appendChild(script);
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PanelUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  }, [router]);

  const redirectByRole = useCallback(
    (role: string) => {
      if (role === "admin") router.push("/dashboard");
      else if (role === "student") router.push("/tasks");
      else router.push("/user");
    },
    [router]
  );

  useEffect(() => {
    const init = async () => {
      // Load TG SDK first so we can check initData
      await loadTelegramWebAppSdk();

      const twa = (window as any).Telegram?.WebApp;

      // initData present — we're inside Telegram Mini App
      // Always prefer initData over stored token to handle account switching
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
          setUser(data.user);

          // Handle deep link start_param
          const startParam = twa.initDataUnsafe?.start_param;
          if (startParam) {
            const decoded = decodeURIComponent(startParam);
            const role = data.user.role as string;
            if (decoded.startsWith("r_")) {
              const requestId = decoded.slice(2);
              router.push(
                role === "user"
                  ? `/user/${requestId}`
                  : `/requests/${requestId}`
              );
              return;
            }
            if (decoded.startsWith("take_")) {
              router.push(`/tasks?take=${decoded.slice(5)}`);
              return;
            }
            if (decoded === "tasks") {
              router.push("/tasks");
              return;
            }
            if (decoded === "history") {
              router.push("/history");
              return;
            }
          }

          if (pathname === "/login" || pathname === "/") {
            redirectByRole(data.user.role);
          }
        } catch {
          // initData auth failed — fall back to stored token below
          const token = localStorage.getItem("token");
          if (!token) {
            if (!isPanelAuthExcluded(pathname)) router.push("/login");
          } else {
            try {
              const u = await authApi.me();
              setUser(u);
            } catch {
              localStorage.removeItem("token");
              if (!isPanelAuthExcluded(pathname)) router.push("/login");
            }
          }
        } finally {
          setLoading(false);
        }
        return;
      }

      // No initData — regular browser, use stored token
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        if (!isPanelAuthExcluded(pathname)) router.push("/login");
        return;
      }

      try {
        const u = await authApi.me();
        setUser(u);
        if (pathname === "/login") {
          redirectByRole(u.role);
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
    (token: string, userData: PanelUser) => {
      localStorage.setItem("token", token);
      setUser(userData);
      redirectByRole(userData.role);
    },
    [redirectByRole]
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
