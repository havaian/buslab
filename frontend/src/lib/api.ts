const BASE = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  formData?: FormData
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !formData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Token expired / invalid — clear and redirect
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }

  return res.json();
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) =>
  request<T>("POST", path, body);
const patch = <T>(path: string, body?: unknown) =>
  request<T>("PATCH", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);
const patchForm = <T>(path: string, form: FormData) =>
  request<T>("PATCH", path, undefined, form);

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  telegramLogin: (data: Record<string, unknown>) =>
    post<{ access_token: string; user: AdminUser }>("/auth/telegram", data),
  me: () => get<AdminUser>("/auth/me"),
};

// ── Requests ──────────────────────────────────────────────────────────────

export const requestsApi = {
  list: (params: RequestListParams) =>
    get<PaginatedResponse<Request>>(`/requests?${toQuery(params)}`),
  findById: (id: string) => get<Request>(`/requests/${id}`),
  approve: (id: string) => patch<Request>(`/requests/${id}/approve`),
  reject: (id: string, reason: string) =>
    patch<Request>(`/requests/${id}/reject`, { reason }),
  assign: (id: string, studentId: string) =>
    patch<Request>(`/requests/${id}/assign`, { studentId }),
  unassign: (id: string) => patch<Request>(`/requests/${id}/unassign`),
  returnToQueue: (id: string) =>
    patch<Request>(`/requests/${id}/return-to-queue`),
  approveAnswer: (id: string, finalAnswer: string, files?: FileList) => {
    const form = new FormData();
    form.append("finalAnswer", finalAnswer);
    if (files) Array.from(files).forEach((f) => form.append("files", f));
    return patchForm<Request>(`/requests/${id}/approve-answer`, form);
  },
  rejectAnswer: (id: string, comment: string) =>
    patch<Request>(`/requests/${id}/reject-answer`, { comment }),
  sendMessage: (id: string, text: string) =>
    post<{ sent: boolean }>(`/requests/${id}/message`, { text }),
  // Student
  available: () => get<Request[]>("/requests/student/available"),
  myHistory: () => get<Request[]>("/requests/student/history"),
  take: (id: string) => patch<Request>(`/requests/${id}/take`),
  submitAnswer: (id: string, answer: string, files?: FileList) => {
    const form = new FormData();
    form.append("answer", answer);
    if (files) Array.from(files).forEach((f) => form.append("files", f));
    return patchForm<Request>(`/requests/${id}/submit-answer`, form);
  },
  decline: (id: string) => patch<Request>(`/requests/${id}/decline`),
};

// ── Admin users / Students ────────────────────────────────────────────────

export const adminUsersApi = {
  students: () => get<AdminUser[]>("/admin-users/students"),
  freeStudents: () => get<AdminUser[]>("/admin-users/students/free"),
  studentStats: (id: string) =>
    get<StudentStats>(`/admin-users/students/${id}/stats`),
  studentLogs: (id: string) =>
    get<StudentLogEntry[]>(`/admin-users/students/${id}/logs`),
  block: (id: string) => patch<AdminUser>(`/admin-users/${id}/block`),
  unblock: (id: string) => patch<AdminUser>(`/admin-users/${id}/unblock`),
};

// ── Citizens ──────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    get<PaginatedResponse<CitizenUser>>(`/users?${toQuery(params || {})}`),
  findById: (id: string) => get<CitizenUser>(`/users/${id}`),
  stats: (id: string) => get<CitizenUserStats>(`/users/${id}/stats`),
  block: (id: string) => patch<CitizenUser>(`/users/${id}/block`),
  unblock: (id: string) => patch<CitizenUser>(`/users/${id}/unblock`),
};

// ── Categories ────────────────────────────────────────────────────────────

export const categoriesApi = {
  list: () => get<Category[]>("/categories"),
  create: (name: string, description?: string) =>
    post<Category>("/categories", { name, description }),
  update: (id: string, name?: string, description?: string) =>
    patch<Category>(`/categories/${id}`, { name, description }),
  remove: (id: string) => del<{ deleted: boolean }>(`/categories/${id}`),
};

// ── FAQ ───────────────────────────────────────────────────────────────────

export const faqApi = {
  list: (search?: string) =>
    get<FaqItem[]>(
      `/faq${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),
  create: (categoryId: string, question: string, answer: string) =>
    post<FaqItem>("/faq", { categoryId, question, answer }),
  update: (id: string, data: Partial<FaqItem>) =>
    patch<FaqItem>(`/faq/${id}`, data),
  remove: (id: string) => del<{ deleted: boolean }>(`/faq/${id}`),
};

// ── Stats ─────────────────────────────────────────────────────────────────

export const statsApi = {
  dashboard: () => get<DashboardStats>("/stats/dashboard"),
  students: () => get<StudentSummary[]>("/stats/students"),
};

// ── Helpers ───────────────────────────────────────────────────────────────

function toQuery(params: object): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v !== undefined && v !== null && v !== "") {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string;
  username: string;
  role: "admin" | "student";
  photoUrl: string;
  isBlocked?: boolean;
}

export interface AttachedFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  ref: string;
  source: "telegram" | "web";
}

export interface Request {
  _id: string;
  telegramUserId: string;
  userFirstName: string;
  userLastName: string;
  userUsername: string;
  userLanguage: string;
  categoryId: { _id: string; name: string } | string;
  text: string;
  files: AttachedFile[];
  status: RequestStatus;
  declineReason: string;
  studentId: AdminUser | null;
  studentAnswer: string;
  studentAnswerFiles: AttachedFile[];
  finalAnswer: string;
  finalAnswerFiles: AttachedFile[];
  adminComment: string;
  timerStart: string | null;
  timerDeadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus =
  | "pending"
  | "approved"
  | "in_progress"
  | "answer_review"
  | "closed"
  | "rejected";

export interface PaginatedResponse<T> {
  requests?: T[];
  users?: T[];
  total: number;
  page: number;
  limit: number;
}

export interface RequestListParams {
  status?: string;
  categoryId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface Category {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface FaqItem {
  _id: string;
  categoryId: string;
  question: string;
  answer: string;
}

export interface CitizenUser {
  _id: string;
  telegramId: string;
  firstName: string;
  lastName: string;
  username: string;
  language: string;
  isBlocked: boolean;
  createdAt: string;
}

export interface CitizenUserStats {
  user: CitizenUser;
  stats: { total: number; closed: number; rejected: number };
  history: Request[];
}

export interface StudentStats {
  total: number;
  submitted: number;
  approved: number;
  rejected: number;
  declines: number;
  unassigned: number;
  expired: number;
  avgTime: number;
  approvalRate: number;
  rating: number | null;
}

export interface StudentLogEntry {
  _id: string;
  action: string;
  requestId: string;
  details: string;
  timeSpentMinutes: number | null;
  createdAt: string;
}

export interface StudentSummary {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  submitted: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  avgTime: number;
  expired: number;
  currentStatus: "free" | "busy" | "overdue";
}

export interface DashboardStats {
  totals: {
    total: number;
    pending: number;
    inProgress: number;
    closed: number;
  };
  periods: { today: number; week: number; month: number };
  activeStudents: number;
  charts: {
    byDay: { _id: string; count: number }[];
    byCategory: { _id: string; name: string; count: number }[];
    byStatus: { _id: string; count: number }[];
  };
}
