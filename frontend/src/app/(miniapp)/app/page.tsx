"use client";

import { useEffect, useState } from "react";
import { useMiniApp } from "../layout";

// ── Types ────────────────────────────────────────────────────────────────────

interface RequestFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  ref: string;
  source: "web" | "telegram";
}

interface MiniRequest {
  _id: string;
  text: string;
  status: string;
  categoryId: { name: string } | string;
  declineReason: string | null;
  finalAnswerText: string | null;
  answerFiles: RequestFile[];
  createdAt: string;
}

// ── Status labels ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "На рассмотрении", color: "text-yellow-600" },
  approved: { label: "Принято", color: "text-blue-600" },
  assigned: { label: "В работе", color: "text-purple-600" },
  answered: { label: "Ответ готовится", color: "text-blue-500" },
  closed: { label: "Закрыто", color: "text-green-600" },
  declined: { label: "Отклонено", color: "text-red-500" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MiniAppPage() {
  const { user, token } = useMiniApp();
  const [requests, setRequests] = useState<MiniRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBase}/requests?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        // Filter only requests belonging to this user (backend already filters by role,
        // but for role "user" we get all — the miniapp auth returns role-aware JWT)
        setRequests(data.requests ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const toggle = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  const catName = (cat: MiniRequest["categoryId"]) =>
    typeof cat === "object" && cat !== null ? cat.name : "—";

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">Юридическая клиника</p>
          {user && (
            <p className="text-xs text-muted-foreground truncate">
              {user.firstName} {user.lastName}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">
        <h1 className="text-sm font-semibold">Мои обращения</h1>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Загрузка...
          </p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            У вас пока нет обращений
          </p>
        ) : (
          requests.map((req) => {
            const meta = STATUS_LABELS[req.status] ?? {
              label: req.status,
              color: "text-muted-foreground",
            };
            const isOpen = expanded === req._id;

            return (
              <div
                key={req._id}
                className="border rounded-lg overflow-hidden bg-card"
              >
                <button
                  className="w-full text-left px-4 py-3 space-y-1"
                  onClick={() => toggle(req._id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(req.createdAt)}
                    </span>
                    <span className={`text-xs font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {catName(req.categoryId)}
                  </p>
                  <p className="text-sm line-clamp-2">{req.text}</p>
                </button>

                {isOpen && (
                  <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
                    {/* Full text */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Текст обращения
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{req.text}</p>
                    </div>

                    {/* Decline reason */}
                    {req.status === "declined" && req.declineReason && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Причина отказа
                        </p>
                        <p className="text-sm text-red-600">
                          {req.declineReason}
                        </p>
                      </div>
                    )}

                    {/* Final answer */}
                    {req.status === "closed" && req.finalAnswerText && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Ответ юридической клиники
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {req.finalAnswerText}
                        </p>
                      </div>
                    )}

                    {/* Answer files */}
                    {req.answerFiles?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Прикреплённые файлы
                        </p>
                        <div className="space-y-1">
                          {req.answerFiles.map((f) => (
                            <a
                              key={f.filename}
                              href={`${apiBase}/files/${f.filename}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs text-primary underline"
                            >
                              📎 {f.originalName}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
