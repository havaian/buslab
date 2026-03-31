"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle, XCircle, Clock, User } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { requestsApi, type Request } from "@/lib/api";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  approved: "Одобрено",
  declined: "Отклонено",
  assigned: "В работе",
  answered: "На проверке",
  closed: "Закрыто",
};

export default function UserProfilePage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestsApi
      .myUserHistory()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = requests.length;
  const closed = requests.filter((r) => r.status === "closed").length;
  const declined = requests.filter((r) => r.status === "declined").length;
  const active = requests.filter(
    (r) =>
      r.status === "assigned" ||
      r.status === "answered" ||
      r.status === "pending" ||
      r.status === "approved"
  ).length;

  const displayName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader title="Профиль" />

      <div className="flex-1 p-4 space-y-4">
        {/* User info card */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User size={22} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {displayName || "-"}
                </p>
                {user?.username && (
                  <p className="text-xs text-muted-foreground truncate">
                    @{user.username}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Request stats */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 px-0.5">
            Мои обращения
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Загрузка...
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Card>
                <CardContent className="pt-3 pb-3 px-4">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-none">{total}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Всего
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 pb-3 px-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle
                      size={16}
                      className="text-green-500 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-none">{closed}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Закрыто
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 pb-3 px-4">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-none">{active}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        В процессе
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 pb-3 px-4">
                  <div className="flex items-center gap-2">
                    <XCircle size={16} className="text-red-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-none">
                        {declined}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Отклонено
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
