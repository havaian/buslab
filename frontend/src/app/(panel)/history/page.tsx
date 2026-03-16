"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { requestsApi, type Request } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileList } from "@/components/shared/file-list";
import { formatDate, getCategoryName } from "@/lib/utils";

export default function HistoryPage() {
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
        <p className="text-sm text-muted-foreground">
          Нет завершённых обращений
        </p>
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
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </span>
                <StatusBadge status={r.status} />
                <span className="text-xs text-muted-foreground">
                  {getCategoryName(r.categoryId)}
                </span>
                <span className="flex-1 text-sm truncate">{r.text}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDate(r.createdAt)}
                </span>
              </div>

              {expanded.has(r._id) && (
                <CardContent className="pt-0 pb-4 space-y-4 border-t">
                  {/* Question */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 mt-3">
                      Вопрос
                    </p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {r.text}
                    </p>
                    <FileList files={r.files} />
                  </div>

                  {/* My answer */}
                  {r.studentAnswer && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Мой ответ
                      </p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {r.studentAnswer}
                      </p>
                      <FileList files={r.studentAnswerFiles} />
                    </div>
                  )}

                  {/* Final answer (if admin edited) */}
                  {r.status === "closed" &&
                    r.finalAnswer &&
                    r.finalAnswer !== r.studentAnswer && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Финальный ответ (отредактирован)
                        </p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
                          {r.finalAnswer}
                        </p>
                        <FileList files={r.finalAnswerFiles} />
                      </div>
                    )}

                  {/* Admin comment */}
                  {r.adminComment && (
                    <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-xs text-orange-800">
                      <span className="font-medium">Комментарий: </span>
                      {r.adminComment}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
