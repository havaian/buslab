"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Link,
  Search,
  Copy,
  Check,
  GraduationCap,
  UserMinus,
  ExternalLink,
} from "lucide-react";
import {
  adminUsersApi,
  type PanelUser,
  type AnyUser,
  type InviteResult,
} from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { getUserDisplayName, formatDate } from "@/lib/utils";

type Tab = "invite" | "search";

export default function StudentsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [students, setStudents] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Add student modal
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("invite");

  // Invite tab state
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Search tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AnyUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Demote confirm
  const [demoteTarget, setDemoteTarget] = useState<PanelUser | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminUsersApi.students();
      setStudents(list.map((s: any) => ({ ...s, id: String(s._id ?? s.id) })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Invite tab ────────────────────────────────────────────────────────────

  const generateInvite = async () => {
    setInviteLoading(true);
    try {
      const result = await adminUsersApi.createInvite();
      setInvite(result);
      setCopied(false);
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setInviteLoading(false);
    }
  };

  const copyLink = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openModal = () => {
    setModalOpen(true);
    setTab("invite");
    setInvite(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  // ── Search tab ────────────────────────────────────────────────────────────

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await adminUsersApi.searchUsers(value.trim());
        setSearchResults(results);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  };

  const handlePromote = async (user: AnyUser) => {
    setBusy(true);
    try {
      await adminUsersApi.promote(user._id);
      toast(`${getUserDisplayName(user)} теперь студент`, "success");
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDemote = async () => {
    if (!demoteTarget) return;
    setBusy(true);
    try {
      await adminUsersApi.demote(demoteTarget.id);
      toast(
        `${getUserDisplayName(demoteTarget)} переведён в пользователи`,
        "success"
      );
      setDemoteTarget(null);
      await load();
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageShell
      title="Студенты"
      description={`${students.length} студентов`}
      actions={
        <Button size="sm" onClick={openModal}>
          <UserPlus size={14} />
          Добавить студента
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap
              size={36}
              className="mx-auto text-muted-foreground/30 mb-3"
            />
            <p className="text-sm text-muted-foreground">Нет студентов</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={openModal}
            >
              Добавить первого студента
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">
                      Студент
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">
                      Telegram ID
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">
                      Статус
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                      onClick={() => router.push(`/students/${s.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{getUserDisplayName(s)}</p>
                        {s.username && (
                          <p className="text-xs text-muted-foreground">
                            @{s.username}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                        {s.telegramId}
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        {s.isBanned ? (
                          <span className="text-xs text-red-500">
                            Заблокирован
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">
                            Активен
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-2.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => router.push(`/students/${s.id}`)}
                          >
                            <ExternalLink size={12} />
                            Профиль
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 text-destructive hover:text-destructive"
                            onClick={() => setDemoteTarget(s)}
                          >
                            <UserMinus size={12} />
                            Убрать
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Add student modal ──────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить студента</DialogTitle>
          </DialogHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 border rounded-md p-1 bg-muted/30">
            <button
              onClick={() => setTab("invite")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded transition-colors ${
                tab === "invite"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link size={12} />
              Invite-ссылка
            </button>
            <button
              onClick={() => setTab("search")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded transition-colors ${
                tab === "search"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Search size={12} />
              Найти в базе
            </button>
          </div>

          {/* ── Invite tab ─────────────────────────────────────────────────── */}
          {tab === "invite" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Сгенерируйте одноразовую ссылку и отправьте студенту. После
                перехода по ссылке и запуска бота — студент автоматически
                получит роль.
              </p>

              {!invite ? (
                <Button
                  className="w-full"
                  onClick={generateInvite}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? "Генерация..." : "Сгенерировать ссылку"}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border bg-muted/30 p-3 break-all text-xs font-mono">
                    {invite.link}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={copyLink}
                    >
                      {copied ? (
                        <>
                          <Check size={13} /> Скопировано
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Копировать
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateInvite}
                      disabled={inviteLoading}
                    >
                      Новая
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ссылка действительна до {formatDate(invite.expiresAt)} (48
                    ч)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Search tab ─────────────────────────────────────────────────── */}
          {tab === "search" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Найдите пользователя, который уже писал боту, по username или
                Telegram ID.
              </p>
              <Input
                placeholder="@username или Telegram ID"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                autoFocus
              />

              {searchLoading && (
                <p className="text-xs text-muted-foreground">Поиск...</p>
              )}

              {!searchLoading &&
                searchQuery.length >= 2 &&
                searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ничего не найдено. Попробуйте другой запрос или используйте
                    invite-ссылку.
                  </p>
                )}

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((u) => (
                  <div
                    key={u._id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {getUserDisplayName(u)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {u.username ? `@${u.username} · ` : ""}
                        ID: {u.telegramId}
                        {u.role === "student" && (
                          <span className="ml-1 text-green-600">
                            · уже студент
                          </span>
                        )}
                      </p>
                    </div>
                    {u.role !== "student" && u.role !== "admin" && (
                      <Button
                        size="sm"
                        className="ml-3 shrink-0"
                        disabled={busy}
                        onClick={() => handlePromote(u)}
                      >
                        <GraduationCap size={13} />
                        Сделать студентом
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Demote confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!demoteTarget}
        onOpenChange={(v) => !v && setDemoteTarget(null)}
        title={`Убрать ${getUserDisplayName(demoteTarget)} из студентов?`}
        description="Пользователь потеряет доступ к веб-панели и будет переведён в обычные пользователи."
        confirmLabel="Убрать"
        variant="destructive"
        loading={busy}
        onConfirm={handleDemote}
      />
    </PageShell>
  );
}
