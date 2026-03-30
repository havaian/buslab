"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { requestsApi, type Request } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateShort, getCategoryName } from "@/lib/utils";

export default function UserRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestsApi
      .myUserHistory()
      .then(setRequests)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell
      title="Мои обращения"
      actions={
        <Button size="sm" onClick={() => router.push("/user/new")}>
          <Plus size={14} /> Подать
        </Button>
      }
    >
      <div className="space-y-2 max-w-2xl">
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
              onClick={() => router.push("/user/new")}
              className="text-sm text-primary font-medium"
            >
              Подать первое обращение →
            </button>
          </div>
        ) : (
          requests.map((r) => (
            <button
              key={r._id}
              onClick={() => router.push(`/user/${r._id}`)}
              className="w-full text-left rounded-xl border bg-card px-4 py-3 space-y-1.5 hover:bg-muted/30 transition-colors"
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
    </PageShell>
  );
}
