"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { authApi, type AdminUser } from "@/lib/api";

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (telegramData: Record<string, unknown>) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ["/login"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
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
      if (!PUBLIC_PATHS.includes(pathname)) router.push("/login");
      return;
    }
    authApi
      .me()
      .then((u) => {
        setUser(u);
        if (PUBLIC_PATHS.includes(pathname)) {
          router.push(u.role === "admin" ? "/dashboard" : "/tasks");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        if (!PUBLIC_PATHS.includes(pathname)) router.push("/login");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (telegramData: Record<string, unknown>) => {
      const res = await authApi.telegramLogin(telegramData);
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
