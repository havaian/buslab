"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { usersApi, type CitizenUser } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { useDialog } from "@/components/ui/dialog-provider";
import { formatDateShort, getUserDisplayName } from "@/lib/utils";

const LIMITS = [10, 25, 50, 100];

export default function UsersPage() {
  const { toast } = useToast();
  const dialog = useDialog();
  const router = useRouter();
  const [users, setUsers] = useState<CitizenUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("_all");
  const [status, setStatus] = useState("_all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({
        search,
        page,
        limit,
        language: language === "_all" ? "" : language,
        status: status === "_all" ? "" : status,
      });
      const fetchedUsers = res.users ?? [];
      setUsers(fetchedUsers);
      setTotal(res.total);

      // If search looks like a telegramId (pure numeric) and returned exactly 1 result — open that user directly
      if (
        /^\d+$/.test(search.trim()) &&
        res.total === 1 &&
        fetchedUsers.length === 1
      ) {
        router.push(`/users/${fetchedUsers[0]._id}`);
      }
    } finally {
      setLoading(false);
    }
  }, [search, page, limit, language, status, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, language, status, limit]);

  const toggleBlock = async (u: CitizenUser) => {
    const ok = await dialog.confirm(
      `${
        u.isBanned ? "Разблокировать" : "Заблокировать"
      } пользователя ${getUserDisplayName(u)}? ${
        u.isBanned
          ? "Он снова сможет использовать бота."
          : "Он не сможет использовать бота."
      }`,
      {
        title: u.isBanned ? "Разблокировать?" : "Заблокировать?",
        variant: u.isBanned ? "default" : "destructive",
        confirmLabel: u.isBanned ? "Разблокировать" : "Заблокировать",
      }
    );
    if (!ok) return;
    setBusy(true);
    try {
      if (u.isBanned) {
        await usersApi.unblock(u._id);
        toast("Пользователь разблокирован", "success");
      } else {
        await usersApi.block(u._id);
        toast("Пользователь заблокирован", "success");
      }
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PageShell title="Пользователи" description={`Всего: ${total}`}>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Поиск по имени, username, Telegram ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Язык" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Все языки</SelectItem>
            <SelectItem value="ru">Русский</SelectItem>
            <SelectItem value="uz">Узбекский</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="kk">Казахский</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="banned">Заблокированные</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={String(limit)}
          onValueChange={(v) => setLimit(Number(v))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMITS.map((l) => (
              <SelectItem key={l} value={String(l)}>
                {l} / стр.
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Имя</th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    Username
                  </th>
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
                      Пользователей не найдено
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u._id}
                      onClick={() => router.push(`/users/${u._id}`)}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {getUserDisplayName(u)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {u.username ? `@${u.username}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {u.telegramId}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {u.language.toUpperCase()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            u.isBanned
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {u.isBanned ? "Заблокирован" : "Активен"}
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
                          disabled={busy}
                          className={
                            u.isBanned
                              ? "text-green-600 border-green-200 hover:bg-green-50"
                              : "text-red-600 border-red-200 hover:bg-red-50"
                          }
                          onClick={() => toggleBlock(u)}
                        >
                          {u.isBanned ? "Разблокировать" : "Заблокировать"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">
            Страница {page} из {totalPages} · {total} записей
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
    </PageShell>
  );
}
