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
    post<{ access_token: string; user: PanelUser }>("/auth/telegram", data),
  me: () => get<PanelUser>("/auth/me"),
};

// ── Requests ──────────────────────────────────────────────────────────────

export const requestsApi = {
  list: (params: RequestListParams) =>
    get<PaginatedRequests>(`/requests?${toQuery(params)}`),
  findById: (id: string) => get<Request>(`/requests/${id}`),
  approve: (id: string) => patch<Request>(`/requests/${id}/approve`),
  reject: (id: string, reason: string) =>
    patch<Request>(`/requests/${id}/reject`, { reason }),
  assign: (id: string, studentId: string) =>
    patch<Request>(`/requests/${id}/assign`, { studentId }),
  unassign: (id: string) => patch<Request>(`/requests/${id}/unassign`),
  returnToQueue: (id: string) =>
    patch<Request>(`/requests/${id}/return-to-queue`),
  approveAnswer: (id: string, finalAnswer: string) =>
    patch<Request>(`/requests/${id}/approve-answer`, { finalAnswer }),
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
  students: () => get<PanelUser[]>("/admin-users/students"),
  freeStudents: () => get<PanelUser[]>("/admin-users/students/free"),
  studentStats: (id: string) =>
    get<StudentStats>(`/admin-users/students/${id}/stats`),
  studentLogs: (id: string) =>
    get<StudentLogEntry[]>(`/admin-users/students/${id}/logs`),
  block: (id: string) => patch<PanelUser>(`/admin-users/${id}/block`),
  unblock: (id: string) => patch<PanelUser>(`/admin-users/${id}/unblock`),
};

// ── Citizens ──────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: {
    search?: string;
    page?: number;
    limit?: number;
    language?: string;
    status?: string;
  }) => get<PaginatedUsers>(`/users?${toQuery(params || {})}`),
  findById: (id: string) => get<CitizenUser>(`/users/${id}`),
  stats: (id: string) => get<CitizenUserStats>(`/users/${id}/stats`),
  block: (id: string) => patch<CitizenUser>(`/users/${id}/block`),
  unblock: (id: string) => patch<CitizenUser>(`/users/${id}/unblock`),
};

// ── Categories ────────────────────────────────────────────────────────────

export const categoriesApi = {
  list: () => get<Category[]>("/categories"),
  create: (name: string, hashtag: string) =>
    post<Category>("/categories", { name, hashtag }),
  update: (id: string, name?: string, hashtag?: string) =>
    patch<Category>(`/categories/${id}`, { name, hashtag }),
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

// User in the panel (admin or student)
export interface PanelUser {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  role: "admin" | "student";
  isBanned?: boolean;
}

// Citizen user (role: 'user')
export interface CitizenUser {
  _id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  language: string;
  isBanned: boolean;
  createdAt: string;
}

// Populated user ref inside a request
export interface PopulatedUser {
  _id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  language?: string;
}

export interface Request {
  _id: string;
  // userId is populated
  userId: PopulatedUser | null;
  categoryId: { _id: string; name: string; hashtag: string } | string;
  text: string;
  status: RequestStatus;
  studentId: PopulatedUser | null;
  assignedAt: string | null;
  answerText: string | null;
  adminComment: string | null;
  declineReason: string | null;
  finalAnswerText: string | null;
  timerDeadline: string | null;
  timerWarningSent: boolean;
  timerExpiredNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "assigned"
  | "answered"
  | "closed";

export interface PaginatedRequests {
  requests: Request[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedUsers {
  users: CitizenUser[];
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
  hashtag: string;
}

export interface FaqItem {
  _id: string;
  categoryId: string;
  question: string;
  answer: string;
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
