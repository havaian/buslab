import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RequestStatus } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Ожидает проверки",
  approved: "Одобрено",
  in_progress: "В работе",
  answer_review: "Ответ на проверке",
  closed: "Закрыто",
  rejected: "Отклонено",
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  answer_review: "bg-orange-100 text-orange-800",
  closed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
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

// Returns remaining ms; negative = expired
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
  if (!categoryId) return "—";
  if (typeof categoryId === "object" && categoryId !== null) {
    return (categoryId as { name: string }).name || "—";
  }
  return String(categoryId);
}
