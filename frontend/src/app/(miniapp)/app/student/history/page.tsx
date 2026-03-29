"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  History,
  User,
} from "lucide-react";
import { requestsApi, type Request } from "@/lib/api";
import { BottomNav } from "../../../_components/bottom-nav";
import { MobileHeader } from "../../../_components/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateShort, getCategoryName } from "@/lib/utils";

const NAV = [
  { href: "/app/student", label: "Задание", icon: ClipboardList },
  { href: "/app/student/history", label: "История", icon: History },
  { href: "/app/student/profile", label: "Профиль", icon: User },
];

export default function StudentHistoryPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    requestsApi
      .myHistory()
      .then(setRequests)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      <MobileHeader title={`История (${requests.length})`} />

      <div className="flex-1 px-3 py-3 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Загрузка...
          </p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Нет выполненных заданий
          </p>
        ) : (
          requests.map((r) => {
            const open = expanded.has(r._id);
            return (
              <div
                key={r._id}
                className="rounded-xl border bg-card overflow-hidden"
              >
                <button
                  onClick={() => toggle(r._id)}
                  className="w-full px-4 py-3 flex items-start gap-2 text-left"
                >
                  <span className="mt-0.5 text-muted-foreground shrink-0">
                    {open ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
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
                  </div>
                </button>

                {open && (
                  <div className="border-t px-4 py-3 space-y-2 bg-muted/20">
                    <p className="text-sm whitespace-pre-wrap">{r.text}</p>
                    {r.finalAnswerText && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Ваш ответ
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {r.finalAnswerText}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <BottomNav items={NAV} />
    </div>
  );
}
