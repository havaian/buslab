"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  usersApi,
  universitiesApi,
  type CitizenUserStats,
  type UniversityWithFaculties,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { BannedBadge } from "@/components/shared/banned-badge";
import { useToast } from "@/components/ui/toast-provider";
import { useDialog } from "@/components/ui/dialog-provider";
import { formatDate, getUserDisplayName } from "@/lib/utils";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const dialog = useDialog();

  const [data, setData] = useState<CitizenUserStats | null>(null);
  const [unis, setUnis] = useState<UniversityWithFaculties[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [stats, uniList] = await Promise.all([
        usersApi.stats(id),
        universitiesApi.list(),
      ]);
      setData(stats);
      setUnis(uniList);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const getUniName = (value: string | null | undefined) => {
    if (!value) return null;
    // university хранится как _id (ObjectId string) — ищем по _id, fallback на code
    const uni = unis.find((u) => String(u._id) === value || u.code === value);
    return uni?.names.ru ?? value;
  };

  const getFacName = (
    uniValue: string | null | undefined,
    facValue: string | null | undefined
  ) => {
    if (!uniValue || !facValue) return null;
    const uni = unis.find((u) => String(u._id) === uniValue || u.code === uniValue);
    return (
      uni?.faculties.find(
        (f) => String(f._id) === facValue || f.code === facValue
      )?.names.ru ?? facValue
    );
  };

  const toggleBlock = async () => {
    if (!data) return;
    const { user } = data;
    const ok = await dialog.confirm(
      `${
        user.isBanned ? "Разблокировать" : "Заблокировать"
      } пользователя ${getUserDisplayName(user)}?`,
      {
        title: user.isBanned ? "Разблокировать?" : "Заблокировать?",
        variant: user.isBanned ? "default" : "destructive",
        confirmLabel: user.isBanned ? "Разблокировать" : "Заблокировать",
      }
    );
    if (!ok) return;
    setBusy(true);
    try {
      if (user.isBanned) {
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
          <ArrowLeft size={14} /> Назад
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
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Роль</span>
                <span>Пользователь</span>
              </div>
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
                <span>{user.language?.toUpperCase()}</span>
              </div>
              {user.university && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">
                    Университет
                  </span>
                  <span className="text-right">
                    {getUniName(user.university)}
                  </span>
                </div>
              )}
              {user.faculty && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">
                    Факультет
                  </span>
                  <span className="text-right text-xs">
                    {getFacName(user.university, user.faculty)}
                  </span>
                </div>
              )}
              {user.course && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Курс</span>
                  <span>{user.course}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Статус</span>
                <BannedBadge isBanned={user.isBanned} />
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
            onClick={toggleBlock}
          >
            {user.isBanned ? "Разблокировать" : "Заблокировать"}
          </Button>
        </div>

        {/* Right: request history */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                История обращений ({history.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-4">
                  Нет обращений
                </p>
              ) : (
                <div className="divide-y">
                  {history.map((r) => (
                    <div
                      key={r._id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/requests/${r._id}`)}
                    >
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {r.text}
                      </span>
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
    </PageShell>
  );
}
