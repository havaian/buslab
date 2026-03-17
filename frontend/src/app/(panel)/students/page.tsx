"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminUsersApi, type PanelUser } from "@/lib/api";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { getUserDisplayName } from "@/lib/utils";

export default function StudentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [students, setStudents] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockTarget, setBlockTarget] = useState<PanelUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setStudents(await adminUsersApi.students());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleBlock = async (s: PanelUser) => {
    setBusy(true);
    try {
      s.isBanned
        ? await adminUsersApi.unblock(s.id)
        : await adminUsersApi.block(s.id);
      toast(s.isBanned ? "Разблокирован" : "Заблокирован", "success");
      await load();
      setBlockTarget(null);
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Студенты" description={`${students.length} студентов`}>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Студент</th>
                <th className="px-4 py-2.5 text-left font-medium">Username</th>
                <th className="px-4 py-2.5 text-left font-medium">Статус</th>
                <th className="px-4 py-2.5 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Загрузка...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Нет студентов
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/students/${s.id}`)}
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {getUserDisplayName(s)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {s.username ? `@${s.username}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.isBanned
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {s.isBanned ? "Заблокирован" : "Активен"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/students/${s.id}`)}
                        >
                          Статистика
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={
                            s.isBanned ? "text-green-600" : "text-red-600"
                          }
                          onClick={() => setBlockTarget(s)}
                        >
                          {s.isBanned ? "Разблокировать" : "Заблокировать"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!blockTarget}
        onOpenChange={(v) => !v && setBlockTarget(null)}
        title={
          blockTarget?.isBanned
            ? "Разблокировать студента?"
            : "Заблокировать студента?"
        }
        description={blockTarget ? getUserDisplayName(blockTarget) : ""}
        variant={blockTarget?.isBanned ? "default" : "destructive"}
        loading={busy}
        onConfirm={() => blockTarget && toggleBlock(blockTarget)}
      />
    </PageShell>
  );
}
