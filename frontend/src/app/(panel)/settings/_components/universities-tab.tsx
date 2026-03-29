"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  universitiesApi,
  type UniversityWithFaculties,
  type UniversityFaculty,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { useDialog } from "@/components/ui/dialog-provider";

type Lang = "ru" | "uz" | "en";
const LANGS: { key: Lang; label: string }[] = [
  { key: "ru", label: "RU" },
  { key: "uz", label: "UZ" },
  { key: "en", label: "EN" },
];

function NamesInput({
  value,
  onChange,
  placeholder,
}: {
  value: { ru: string; uz: string; en: string };
  onChange: (v: { ru: string; uz: string; en: string }) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LANGS.map(({ key, label }) => (
        <div key={key} className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {label}
          </label>
          <Input
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            placeholder={placeholder ?? label}
            className="text-sm h-8"
          />
        </div>
      ))}
    </div>
  );
}

function CoursesInput({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const ALL_COURSES = [1, 2, 3, 4, 5, 6];
  return (
    <div className="flex gap-2 flex-wrap">
      {ALL_COURSES.map((c) => {
        const active = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() =>
              onChange(
                active ? value.filter((x) => x !== c) : [...value, c].sort()
              )
            }
            className={`h-8 w-8 rounded-lg text-sm font-medium border transition-colors ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input text-muted-foreground"
            }`}
          >
            {c}
          </button>
        );
      })}
      <span className="text-xs text-muted-foreground self-center">курсы</span>
    </div>
  );
}

// ── Faculty row ───────────────────────────────────────────────────────────────

function FacultyRow({
  fac,
  uniId,
  onUpdated,
  onDeleted,
}: {
  fac: UniversityFaculty;
  uniId: string;
  onUpdated: (f: UniversityFaculty) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const dialog = useDialog();
  const [editing, setEditing] = useState(false);
  const [names, setNames] = useState(fac.names);
  const [code, setCode] = useState(fac.code);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await universitiesApi.updateFaculty(uniId, fac._id, {
        code,
        names,
      });
      onUpdated(updated as any);
      setEditing(false);
      toast("Сохранено", "success");
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    const ok = await dialog.confirm(`Удалить факультет «${fac.names.ru}»?`, {
      variant: "destructive",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await universitiesApi.deleteFaculty(uniId, fac._id);
      onDeleted(fac._id);
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Код
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-sm h-8 font-mono"
          />
        </div>
        <NamesInput value={names} onChange={setNames} placeholder="Название" />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={save}
            disabled={busy}
            className="h-7 text-xs"
          >
            <Check size={12} /> Сохранить
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(false);
              setNames(fac.names);
              setCode(fac.code);
            }}
            className="h-7 text-xs"
          >
            <X size={12} /> Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm truncate">{fac.names.ru}</p>
        <p className="text-xs text-muted-foreground">
          {fac.names.uz} · {fac.names.en}
        </p>
        <p className="text-xs font-mono text-muted-foreground/60">{fac.code}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={del}
          disabled={busy}
          className="p-1 text-muted-foreground hover:text-destructive"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── University card ───────────────────────────────────────────────────────────

function UniversityCard({
  uni,
  onUpdated,
  onDeleted,
}: {
  uni: UniversityWithFaculties;
  onUpdated: (u: UniversityWithFaculties) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const dialog = useDialog();
  const [expanded, setExpanded] = useState(false);
  const [editingUni, setEditingUni] = useState(false);
  const [names, setNames] = useState(uni.names);
  const [code, setCode] = useState(uni.code);
  const [courses, setCourses] = useState(uni.courses);
  const [faculties, setFaculties] = useState<UniversityFaculty[]>(
    uni.faculties ?? []
  );
  const [busy, setBusy] = useState(false);

  // Add faculty form
  const [addingFac, setAddingFac] = useState(false);
  const [newFacCode, setNewFacCode] = useState("");
  const [newFacNames, setNewFacNames] = useState({ ru: "", uz: "", en: "" });

  const saveUni = async () => {
    setBusy(true);
    try {
      const updated = await universitiesApi.update(uni._id, {
        code,
        names,
        courses,
      });
      onUpdated({ ...updated, faculties } as any);
      setEditingUni(false);
      toast("Сохранено", "success");
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const delUni = async () => {
    const ok = await dialog.confirm(
      `Удалить университет «${uni.names.ru}» и все его факультеты?`,
      { variant: "destructive", confirmLabel: "Удалить" }
    );
    if (!ok) return;
    setBusy(true);
    try {
      await universitiesApi.remove(uni._id);
      onDeleted(uni._id);
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const addFaculty = async () => {
    if (!newFacCode || !newFacNames.ru) return;
    setBusy(true);
    try {
      const fac = await universitiesApi.createFaculty(uni._id, {
        code: newFacCode,
        names: newFacNames,
      });
      setFaculties((prev) => [...prev, fac as any]);
      setAddingFac(false);
      setNewFacCode("");
      setNewFacNames({ ru: "", uz: "", en: "" });
      toast("Факультет добавлен", "success");
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-muted/20"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{uni.names.ru}</p>
          <p className="text-xs text-muted-foreground">
            {uni.names.uz} · {uni.names.en} ·{" "}
            <span className="font-mono">{uni.code}</span>
          </p>
        </div>
        <div
          className="flex gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setEditingUni((p) => !p);
              setExpanded(true);
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={delUni}
            disabled={busy}
            className="p-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-4 border-t">
          {/* Edit university form */}
          {editingUni && (
            <div className="space-y-3 pt-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Код
                </label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-sm h-8 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Названия
                </label>
                <NamesInput
                  value={names}
                  onChange={setNames}
                  placeholder="Название"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Курсы
                </label>
                <CoursesInput value={courses} onChange={setCourses} />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveUni}
                  disabled={busy}
                  className="h-7 text-xs"
                >
                  <Check size={12} /> Сохранить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingUni(false);
                    setNames(uni.names);
                    setCode(uni.code);
                    setCourses(uni.courses);
                  }}
                  className="h-7 text-xs"
                >
                  <X size={12} /> Отмена
                </Button>
              </div>
            </div>
          )}

          {/* Faculties */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Факультеты ({faculties.length})
            </p>
            {faculties.length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет факультетов</p>
            ) : (
              faculties.map((f) => (
                <FacultyRow
                  key={f._id}
                  fac={f}
                  uniId={uni._id}
                  onUpdated={(updated) =>
                    setFaculties((prev) =>
                      prev.map((x) => (x._id === updated._id ? updated : x))
                    )
                  }
                  onDeleted={(id) =>
                    setFaculties((prev) => prev.filter((x) => x._id !== id))
                  }
                />
              ))
            )}

            {/* Add faculty */}
            {addingFac ? (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Код
                  </label>
                  <Input
                    value={newFacCode}
                    onChange={(e) => setNewFacCode(e.target.value)}
                    placeholder="public_law"
                    className="text-sm h-8 font-mono"
                  />
                </div>
                <NamesInput
                  value={newFacNames}
                  onChange={setNewFacNames}
                  placeholder="Название факультета"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={addFaculty}
                    disabled={busy || !newFacCode || !newFacNames.ru}
                    className="h-7 text-xs"
                  >
                    <Check size={12} /> Добавить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAddingFac(false);
                      setNewFacCode("");
                      setNewFacNames({ ru: "", uz: "", en: "" });
                    }}
                    className="h-7 text-xs"
                  >
                    <X size={12} /> Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingFac(true)}
                className="flex items-center gap-1.5 text-xs text-primary"
              >
                <Plus size={13} /> Добавить факультет
              </button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function UniversitiesTab() {
  const { toast } = useToast();
  const [unis, setUnis] = useState<UniversityWithFaculties[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [newNames, setNewNames] = useState({ ru: "", uz: "", en: "" });
  const [newCourses, setNewCourses] = useState([1, 2, 3, 4]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUnis(await universitiesApi.list(true));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!newCode || !newNames.ru) return;
    setBusy(true);
    try {
      await universitiesApi.create({
        code: newCode,
        names: newNames,
        courses: newCourses,
      });
      await load();
      setAdding(false);
      setNewCode("");
      setNewNames({ ru: "", uz: "", en: "" });
      setNewCourses([1, 2, 3, 4]);
      toast("Университет добавлен", "success");
    } catch (e: unknown) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : (
        <>
          {unis.map((u) => (
            <UniversityCard
              key={u._id}
              uni={u}
              onUpdated={(updated) =>
                setUnis((prev) =>
                  prev.map((x) => (x._id === updated._id ? updated : x))
                )
              }
              onDeleted={(id) =>
                setUnis((prev) => prev.filter((x) => x._id !== id))
              }
            />
          ))}

          {/* Add university */}
          {adding ? (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm">Новый университет</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Код (латиница, без пробелов)
                  </label>
                  <Input
                    value={newCode}
                    onChange={(e) =>
                      setNewCode(
                        e.target.value.toLowerCase().replace(/\s+/g, "_")
                      )
                    }
                    placeholder="my_university"
                    className="text-sm h-8 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Названия
                  </label>
                  <NamesInput
                    value={newNames}
                    onChange={setNewNames}
                    placeholder="Название"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Курсы
                  </label>
                  <CoursesInput value={newCourses} onChange={setNewCourses} />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={create}
                    disabled={busy || !newCode || !newNames.ru}
                  >
                    Добавить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAdding(false);
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(true)}
              className="w-full"
            >
              <Plus size={14} /> Добавить университет
            </Button>
          )}
        </>
      )}
    </div>
  );
}
