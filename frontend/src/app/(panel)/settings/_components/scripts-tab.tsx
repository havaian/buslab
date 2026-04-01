"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import { scriptsApi, type ScriptRun } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

function StatusBadge({ status }: { status: ScriptRun["status"] }) {
  const map = {
    running:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
    success:
      "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
    error: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  };
  const labels = {
    running: "Выполняется",
    success: "Успешно",
    error: "Ошибка",
  };
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function RunDetail({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [run, setRun] = useState<ScriptRun | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      const data = await scriptsApi.getById(runId);
      setRun(data);
      if (data.status !== "running" && pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
    load();
    pollRef.current = setInterval(load, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [run?.output]);

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          {run && <StatusBadge status={run.status} />}
          <span className="text-muted-foreground text-xs">
            {run ? new Date(run.createdAt).toLocaleString("ru-RU") : ""}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Закрыть
        </button>
      </div>
      <pre className="text-xs font-mono p-4 bg-black text-green-400 max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
        {run?.output || "Ожидаем вывод..."}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}

export function ScriptsTab() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ScriptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      const data = await scriptsApi.logs();
      setLogs(data);
      setRunning(data.some((r) => r.status === "running"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const { runId } = await scriptsApi.run();
      setActiveRunId(runId);
      await loadLogs();
    } catch (e: unknown) {
      toast((e as Error).message || "Ошибка запуска", "error");
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Парсинг студентов из опросов
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Читает результаты голосований в студенческом чате через MTProto и
            обновляет профили студентов (университет, факультет, курс) в базе
            данных.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleRun} disabled={running} size="sm">
              <Play className="w-4 h-4 mr-1.5" />
              {running ? "Выполняется..." : "Запустить"}
            </Button>
            <Button onClick={loadLogs} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Обновить
            </Button>
          </div>
          {activeRunId && (
            <RunDetail
              runId={activeRunId}
              onClose={() => setActiveRunId(null)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">История запусков</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Запусков ещё не было
            </p>
          ) : (
            <div className="space-y-1">
              {logs.map((run) => (
                <button
                  key={run._id}
                  onClick={() =>
                    setActiveRunId(activeRunId === run._id ? null : run._id)
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm border transition-colors hover:bg-muted ${
                    activeRunId === run._id
                      ? "bg-muted border-border"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={run.status} />
                    <span className="text-muted-foreground text-xs">
                      {new Date(run.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  {run.finishedAt && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(
                        (new Date(run.finishedAt).getTime() -
                          new Date(run.createdAt).getTime()) /
                          1000
                      )}
                      с
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
