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

// Paths where auth-context should not redirect to /login and should not
// redirect away after successful token check — miniapp handles its own auth
const isPanelAuthExcluded = (pathname: string) =>
  pathname === "/login" ||
  pathname === "/privacy" ||
  pathname.startsWith("/user");

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

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      // Try Telegram WebApp initData before redirecting to login
      const twa = (window as any).Telegram?.WebApp;
      if (twa?.initData) {
        twa.ready();
        twa.expand();
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
        fetch(`${apiBase}/miniapp/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: twa.initData }),
        })
          .then((r) => r.json())
          .then((data) => {
            localStorage.setItem("token", data.access_token);
            setUser(data.user);
            const startParam = twa.initDataUnsafe?.start_param;
            if (startParam) {
              const decoded = decodeURIComponent(startParam);
              const role = data.user.role as string;
              if (decoded.startsWith("r_")) {
                const requestId = decoded.slice(2);
                router.push(role === "user" ? `/user/${requestId}` : `/requests/${requestId}`);
                return;
              }
              if (decoded.startsWith("take_")) {
                router.push(`/tasks?take=${decoded.slice(5)}`);
                return;
              }
              if (decoded === "tasks") { router.push("/tasks"); return; }
              if (decoded === "history") { router.push("/history"); return; }
            }
            if (pathname === "/login") {
              router.push(
                data.user.role === "admin"
                  ? "/dashboard"
                  : data.user.role === "student"
                  ? "/tasks"
                  : "/user"
              );
            }
          })
          .catch(() => {
            if (!isPanelAuthExcluded(pathname)) router.push("/login");
          })
          .finally(() => setLoading(false));
        return;
      }

      setLoading(false);
      if (!isPanelAuthExcluded(pathname)) router.push("/login");
      return;
    }
    authApi
      .me()
      .then((u) => {
        setUser(u);
        // Only redirect panel users away from /login — miniapp routes handle themselves
        if (pathname === "/login") {
          router.push(u.role === "admin" ? "/dashboard" : "/tasks");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        if (!isPanelAuthExcluded(pathname)) router.push("/login");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (idToken: string) => {
      const res = await authApi.telegramLogin(idToken);
      localStorage.setItem("token", res.access_token);
      setUser(res.user);
      router.push(res.user.role === "admin" ? "/dashboard" : "/tasks");
    },
    [router]
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
