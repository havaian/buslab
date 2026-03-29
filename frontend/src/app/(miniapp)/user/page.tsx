"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, User } from "lucide-react";
import { requestsApi, type Request } from "@/lib/api";
import { BottomNav } from "../_components/bottom-nav";
import { MobileHeader } from "../_components/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateShort, getCategoryName } from "@/lib/utils";
import { useMiniApp } from "../miniapp-context";

const NAV = [
  { href: "/app/user", label: "Обращения", icon: FileText },
  { href: "/app/user/new", label: "Подать", icon: Plus },
  { href: "/app/user/profile", label: "Профиль", icon: User },
];

export default function UserRequestsPage() {
  const router = useRouter();
  const { user } = useMiniApp();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestsApi
      .myUserHistory()
      .then(setRequests)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      <MobileHeader
        title="Мои обращения"
        right={
          <button
            onClick={() => router.push("/app/user/new")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus size={16} />
          </button>
        }
      />

      <div className="flex-1 px-3 py-3 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Загрузка...
          </p>
        ) : requests.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <FileText size={40} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              У вас ещё нет обращений
            </p>
            <button
              onClick={() => router.push("/app/user/new")}
              className="text-sm text-primary font-medium"
            >
              Подать первое обращение →
            </button>
          </div>
        ) : (
          requests.map((r) => (
            <button
              key={r._id}
              onClick={() => router.push(`/app/user/${r._id}`)}
              className="w-full text-left rounded-xl border bg-card px-4 py-3 space-y-1.5 active:opacity-70"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDateShort(r.createdAt)}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {getCategoryName(r.categoryId)}
              </p>
              <p className="text-sm line-clamp-2">{r.text}</p>
            </button>
          ))
        )}
      </div>

      <BottomNav items={NAV} />
    </div>
  );
}
