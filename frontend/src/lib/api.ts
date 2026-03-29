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
const put = <T>(path: string, body?: unknown) => request<T>("PUT", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);
const patchForm = <T>(path: string, form: FormData) =>
  request<T>("PATCH", path, undefined, form);

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  telegramLogin: (idToken: string) =>
    post<{ access_token: string; user: PanelUser }>("/auth/telegram", {
      id_token: idToken,
    }),
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
  rejectStandard: (id: string) =>
    patch<Request>(`/requests/${id}/reject-standard`),
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
  getHistory: (id: string) =>
    get<RequestHistoryEntry[]>(`/requests/${id}/history`),
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
  studentById: (id: string) => get<PanelUser>(`/admin-users/students/${id}`),
  studentStats: (id: string) =>
    get<StudentStats>(`/admin-users/students/${id}/stats`),
  studentLogs: (id: string) =>
    get<StudentLogEntry[]>(`/admin-users/students/${id}/logs`),
  block: (id: string) => patch<PanelUser>(`/admin-users/${id}/block`),
  unblock: (id: string) => patch<PanelUser>(`/admin-users/${id}/unblock`),
  // ── Student self-access ─────────────────────────────────────────────────
  myStats: () => get<StudentStats>("/admin-users/my-stats"),
  myLogs: () => get<StudentLogEntry[]>("/admin-users/my-logs"),
  // ── Student management ──────────────────────────────────────────────────
  createInvite: () => post<InviteResult>("/admin-users/invite"),
  searchUsers: (q: string) =>
    get<AnyUser[]>(`/admin-users/users/search?q=${encodeURIComponent(q)}`),
  promote: (id: string) => patch<AnyUser>(`/admin-users/${id}/promote`),
  demote: (id: string) => patch<AnyUser>(`/admin-users/${id}/demote`),
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
  create: (data: { name: string; hashtag: string; names: LocalizedNames }) =>
    post<Category>("/categories", data),
  update: (
    id: string,
    data: { name?: string; hashtag?: string; names?: LocalizedNames }
  ) => patch<Category>(`/categories/${id}`, data),
  remove: (id: string) => del<{ deleted: boolean }>(`/categories/${id}`),
};

// ── FAQ ───────────────────────────────────────────────────────────────────

export const faqApi = {
  list: (search?: string) =>
    get<FaqItem[]>(
      `/faq${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),
  create: (
    categoryId: string,
    question: string,
    answer: string,
    translations?: FaqTranslations
  ) => post<FaqItem>("/faq", { categoryId, question, answer, translations }),
  update: (
    id: string,
    data: Partial<FaqItem> & { translations?: FaqTranslations }
  ) => patch<FaqItem>(`/faq/${id}`, data),
  remove: (id: string) => del<{ deleted: boolean }>(`/faq/${id}`),
};

// ── Stats ─────────────────────────────────────────────────────────────────

export const statsApi = {
  dashboard: () => get<DashboardStats>("/stats/dashboard"),
  students: () => get<StudentSummary[]>("/stats/students"),
};

// ── Settings ──────────────────────────────────────────────────────────────

export const settingsApi = {
  get: (key: string) => get<Record<string, string>>(`/settings/${key}`),
  set: (key: string, value: Record<string, string>) =>
    put<Record<string, string>>(`/settings/${key}`, { value }),
};

// ── Locales ───────────────────────────────────────────────────────────────

export const localesApi = {
  get: (locale: string) =>
    get<Record<string, any>>(`/settings/locales/${locale}`),
  set: (locale: string, content: Record<string, any>) =>
    put<{ ok: boolean }>(`/settings/locales/${locale}`, { content }),
};

// ── Legal documents ───────────────────────────────────────────────────────

export const legalApi = {
  info: () => get<Record<string, boolean>>("/legal"),
  upload: (locale: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ ok: boolean }>("POST", `/legal/${locale}`, undefined, form);
  },
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

export interface PanelUser {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  role: "admin" | "student";
  isBanned?: boolean;
}

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

/** Any user from DB (role: user | student | admin) — used in search results */
export interface AnyUser {
  _id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
}

export interface InviteResult {
  token: string;
  expiresAt: string;
  link: string;
}

export interface PopulatedUser {
  _id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  username: string;
  language?: string;
}

export interface RequestHistoryEntry {
  _id: string;
  requestId: string;
  action: string;
  performedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    role: string;
  } | null;
  performedByRole: "admin" | "student" | "citizen" | "system";
  statusFrom: string | null;
  statusTo: string | null;
  answerText: string | null;
  answerFiles: RequestFile[];
  comment: string | null;
  createdAt: string;
}

export interface RequestFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  ref: string;
  source: "web" | "telegram";
}

export interface Request {
  _id: string;
  userId: PopulatedUser | null;
  categoryId: { _id: string; name: string; hashtag: string } | string;
  text: string;
  status: RequestStatus;
  studentId: PopulatedUser | null;
  assignedAt: string | null;
  answerText: string | null;
  answerFiles: RequestFile[];
  requestFiles: RequestFile[];
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

export interface LocalizedNames {
  ru: string;
  uz: string;
  en: string;
}

export interface FaqTranslation {
  question: string;
  answer: string;
}

export interface FaqTranslations {
  ru?: FaqTranslation;
  uz?: FaqTranslation;
  en?: FaqTranslation;
}

export interface Category {
  _id: string;
  name: string;
  hashtag: string;
  names: LocalizedNames;
}

export interface FaqItem {
  _id: string;
  categoryId: string;
  question: string;
  answer: string;
  translations: FaqTranslations;
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
