"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMiniApp } from "../miniapp-context";

export default function MiniAppIndexPage() {
  const { user } = useMiniApp();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    // Admin and student use the existing panel pages
    if (user.role === "admin") router.replace("/dashboard");
    else if (user.role === "student") router.replace("/tasks");
    // Citizens stay in miniapp routes
    else router.replace("/app/user");
  }, [user, router]);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
      Загрузка...
    </div>
  );
}