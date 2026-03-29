"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Users, GraduationCap } from "lucide-react";
import { adminUsersApi, type PanelUser } from "@/lib/api";
import { BottomNav } from "../../../_components/bottom-nav";
import { MobileHeader } from "../../../_components/mobile-header";
import { getUserDisplayName } from "@/lib/utils";

const NAV = [
  { href: "/app/admin", label: "Обращения", icon: FileText },
  { href: "/app/admin/users", label: "Граждане", icon: Users },
  { href: "/app/admin/students", label: "Студенты", icon: GraduationCap },
];

export default function AdminStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminUsersApi
      .students()
      .then((list) =>
        setStudents(list.map((s: any) => ({ ...s, id: String(s._id ?? s.id) })))
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      <MobileHeader title={`Студенты (${students.length})`} />

      <div className="flex-1 px-3 py-3 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Загрузка...
          </p>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Нет студентов
          </p>
        ) : (
          students.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/students/${s.id}`)}
              className="w-full text-left rounded-xl border bg-card px-4 py-3 space-y-0.5 active:opacity-70"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{getUserDisplayName(s)}</p>
                {s.isBanned && (
                  <span className="text-xs text-red-500 font-medium">
                    Заблокирован
                  </span>
                )}
              </div>
              {s.username && (
                <p className="text-xs text-muted-foreground">@{s.username}</p>
              )}
            </button>
          ))
        )}
      </div>

      <BottomNav items={NAV} />
    </div>
  );
}
