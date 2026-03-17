"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usersApi, type CitizenUserStats } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate, getUserDisplayName } from "@/lib/utils";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<CitizenUserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await usersApi.stats(id);
      setData(s);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBlock = async () => {
    if (!data) return;
    setBusy(true);
    try {
      if (data.user.isBanned) {
        await usersApi.unblock(id);
        toast("Пользователь разблокирован", "success");
      } else {
        await usersApi.block(id);
        toast("Пользователь заблокирован", "success");
      }
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      setConfirmBlock(false);
    }
  };

  if (loading || !data) {
    return (
      <PageShell title="Пользователь">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </PageShell>
    );
  }

  const { user, stats, history } = data;

  return (
    <PageShell
      title={getUserDisplayName(user)}
      actions={
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={14} />
          Назад
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: info + stats + block */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {user.username && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">
                    Username
                  </span>
                  <span>@{user.username}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">
                  Telegram ID
                </span>
                <span className="font-mono text-xs">{user.telegramId}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Язык</span>
                <span>{user.language.toUpperCase()}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Статус</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    user.isBanned
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {user.isBanned ? "Заблокирован" : "Активен"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">
                  Регистрация
                </span>
                <span className="text-xs text-right">
                  {formatDate(user.createdAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["Всего", stats.total],
                ["Закрыто", stats.closed],
                ["Отклонено", stats.rejected],
              ] as [string, number][]
            ).map(([label, value]) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 text-center px-2">
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            variant={user.isBanned ? "default" : "destructive"}
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() => setConfirmBlock(true)}
          >
            {user.isBanned ? "Разблокировать" : "Заблокировать"}
          </Button>
        </div>

        {/* Right: request history */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                История обращений ({history.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-4">
                  Обращений нет
                </p>
              ) : (
                <div className="divide-y">
                  {history.map((r) => (
                    <div
                      key={r._id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/requests/${r._id}`)}
                    >
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        #{r._id.slice(-6)}
                      </span>
                      <StatusBadge status={r.status} />
                      <span className="flex-1 truncate text-sm">{r.text}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={
          user.isBanned
            ? "Разблокировать пользователя?"
            : "Заблокировать пользователя?"
        }
        description={`${getUserDisplayName(user)} ${
          user.isBanned
            ? "снова сможет использовать бота"
            : "будет заблокирован и не сможет использовать бота"
        }`}
        confirmLabel={user.isBanned ? "Разблокировать" : "Заблокировать"}
        variant={user.isBanned ? "default" : "destructive"}
        onConfirm={toggleBlock}
        loading={busy}
      />
    </PageShell>
  );
}
