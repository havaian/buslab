import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RequestStatus } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Ожидает проверки",
  approved: "Одобрено",
  declined: "Отклонено",
  assigned: "В работе",
  answered: "Ответ на проверке",
  closed: "Закрыто",
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  declined: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  assigned:
    "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  answered:
    "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  closed:
    "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function getTimerMs(deadline: string | null): number {
  if (!deadline) return 0;
  return new Date(deadline).getTime() - Date.now();
}

export function formatTimer(ms: number): string {
  if (ms <= 0) return "Истёк";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

export function getTimerColor(ms: number): string {
  if (ms <= 0) return "text-red-600 animate-pulse";
  if (ms < 2 * 60 * 60 * 1000) return "text-red-500";
  if (ms < 6 * 60 * 60 * 1000) return "text-orange-500";
  return "text-green-600";
}

export function getCategoryName(categoryId: unknown): string {
  if (!categoryId) return "-";
  if (typeof categoryId === "object" && categoryId !== null) {
    return (categoryId as { name: string }).name || "-";
  }
  return String(categoryId);
}

export function getUserDisplayName(
  user:
    | { firstName?: string; lastName?: string; username?: string }
    | null
    | undefined
): string {
  if (!user) return "-";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.username || "-";
}
