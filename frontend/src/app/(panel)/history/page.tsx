"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { requestsApi, type Request } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, getCategoryName } from "@/lib/utils";

export default function HistoryPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    requestsApi
      .myHistory()
      .then(setRequests)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <PageShell title="Моя история" description={`${requests.length} обращений`}>
      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет обращений</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r._id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20"
                onClick={() => toggle(r._id)}
              >
                <span className="text-muted-foreground shrink-0">
                  {expanded.has(r._id) ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  #{r._id.slice(-6)}
                </span>
                <StatusBadge status={r.status} />
                <span className="flex-1 truncate text-sm">
                  {getCategoryName(r.categoryId)}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 hidden sm:inline">
                  {formatDate(r.createdAt)}
                </span>
                {/* Открыть страницу обращения */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/requests/${r._id}`);
                  }}
                  className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                  title="Открыть обращение"
                >
                  <ExternalLink size={14} />
                </button>
              </div>

              {expanded.has(r._id) && (
                <CardContent className="pt-0 pb-3 px-4 border-t">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed mt-3">
                    {r.text}
                  </p>
                  {r.answerText && (
                    <div className="mt-3 border-l-2 border-green-500 pl-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Ответ
                      </p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {r.finalAnswerText || r.answerText}
                      </p>
                    </div>
                  )}
                  {r.adminComment && (
                    <div className="mt-2 border-l-2 border-yellow-500 pl-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Комментарий администратора
                      </p>
                      <p className="text-sm">{r.adminComment}</p>
                    </div>
                  )}
                  <button
                    onClick={() => router.push(`/requests/${r._id}`)}
                    className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={12} />
                    Открыть полную страницу обращения
                  </button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
