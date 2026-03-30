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
const isPublicPath = (pathname: string) =>
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
      setLoading(false);
      if (!isPublicPath(pathname)) router.push("/login");
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
        if (!isPublicPath(pathname)) router.push("/login");
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
