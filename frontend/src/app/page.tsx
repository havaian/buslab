"use client";

// Корень приложения — auth-context сам обрабатывает редирект
// (убрали server-side redirect("/login") который вызывал 404 flash в Mini App)
export default function RootPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo.svg" alt="Логотип" className="h-10 w-10 opacity-60" />
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </div>
    </div>
  );
}
