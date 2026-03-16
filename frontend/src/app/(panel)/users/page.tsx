"use client";

import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";
import { usersApi, type CitizenUser, type CitizenUserStats } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate, formatDateShort } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function UsersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [users, setUsers] = useState<CitizenUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  const [selectedUser, setSelectedUser] = useState<CitizenUser | null>(null);
  const [userStats, setUserStats] = useState<CitizenUserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState<CitizenUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ search, page, limit });
      setUsers(res.users ?? []);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [search]);

  const openUser = async (u: CitizenUser) => {
    setSelectedUser(u);
    setStatsLoading(true);
    try {
      const s = await usersApi.stats(u._id);
      setUserStats(s);
    } finally {
      setStatsLoading(false);
    }
  };

  const toggleBlock = async (u: CitizenUser) => {
    setBusy(true);
    try {
      if (u.isBlocked) {
        await usersApi.unblock(u._id);
        toast("Пользователь разблокирован", "success");
      } else {
        await usersApi.block(u._id);
        toast("Пользователь заблокирован", "success");
      }
      await load();
      setBlockConfirm(null);
      if (selectedUser?._id === u._id) {
        setSelectedUser((p) => (p ? { ...p, isBlocked: !p.isBlocked } : p));
      }
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PageShell title="Пользователи" description={`Всего: ${total}`}>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Имя</th>
                <th className="px-4 py-2.5 text-left font-medium">Username</th>
                <th className="px-4 py-2.5 text-left font-medium">
                  Telegram ID
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Язык</th>
                <th className="px-4 py-2.5 text-left font-medium">Статус</th>
                <th className="px-4 py-2.5 text-left font-medium">
                  Регистрация
                </th>
                <th className="px-4 py-2.5 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Загрузка...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Нет пользователей
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u._id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => openUser(u)}
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {u.username ? `@${u.username}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {u.telegramId}
                    </td>
                    <td className="px-4 py-2.5 uppercase text-xs">
                      {u.language}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.isBlocked
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {u.isBlocked ? "Заблокирован" : "Активен"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatDateShort(u.createdAt)}
                    </td>
                    <td
                      className="px-4 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className={
                          u.isBlocked
                            ? "text-green-600 border-green-200 hover:bg-green-50"
                            : "text-red-600 border-red-200 hover:bg-red-50"
                        }
                        onClick={() => setBlockConfirm(u)}
                      >
                        {u.isBlocked ? "Разблокировать" : "Заблокировать"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">
            Страница {page} из {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
            </Button>
          </div>
        </div>
      )}

      {/* User detail modal */}
      <Dialog
        open={!!selectedUser}
        onOpenChange={(v) => !v && setSelectedUser(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogTitle>
          </DialogHeader>
          {statsLoading ? (
            <p className="text-sm text-muted-foreground py-4">Загрузка...</p>
          ) : (
            userStats && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Username:</span>{" "}
                    {userStats.user.username
                      ? `@${userStats.user.username}`
                      : "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Язык:</span>{" "}
                    {userStats.user.language.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-muted-foreground">TG ID:</span>{" "}
                    <span className="font-mono text-xs">
                      {userStats.user.telegramId}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Статус:</span>{" "}
                    {userStats.user.isBlocked ? "Заблокирован" : "Активен"}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Всего", userStats.stats.total],
                    ["Закрыто", userStats.stats.closed],
                    ["Отклонено", userStats.stats.rejected],
                  ].map(([l, v]) => (
                    <div
                      key={String(l)}
                      className="rounded-lg border p-3 text-center"
                    >
                      <p className="text-xl font-bold">{v}</p>
                      <p className="text-xs text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    История обращений
                  </p>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {userStats.history.map((r) => (
                      <div
                        key={r._id}
                        className="flex items-center gap-3 rounded-md border px-3 py-2 text-xs cursor-pointer hover:bg-accent"
                        onClick={() => {
                          setSelectedUser(null);
                          router.push(`/requests/${r._id}`);
                        }}
                      >
                        <span className="font-mono text-muted-foreground">
                          #{r._id.slice(-6)}
                        </span>
                        <span className="flex-1 truncate">{r.text}</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {formatDateShort(r.createdAt)}
                        </span>
                      </div>
                    ))}
                    {userStats.history.length === 0 && (
                      <p className="text-muted-foreground">Нет обращений</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={
                      userStats.user.isBlocked ? "default" : "destructive"
                    }
                    disabled={busy}
                    onClick={() => toggleBlock(userStats.user)}
                  >
                    {userStats.user.isBlocked
                      ? "Разблокировать"
                      : "Заблокировать"}
                  </Button>
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!blockConfirm}
        onOpenChange={(v) => !v && setBlockConfirm(null)}
        title={
          blockConfirm?.isBlocked
            ? "Разблокировать пользователя?"
            : "Заблокировать пользователя?"
        }
        description={`${blockConfirm?.firstName} ${blockConfirm?.lastName}`}
        variant={blockConfirm?.isBlocked ? "default" : "destructive"}
        loading={busy}
        onConfirm={() => blockConfirm && toggleBlock(blockConfirm)}
      />
    </PageShell>
  );
}
