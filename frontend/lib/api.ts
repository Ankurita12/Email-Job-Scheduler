export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  me: () => req("/auth/me"),
  demoLogin: () =>
    req("/auth/demo-login", { method: "POST", body: JSON.stringify({}) }),
  logout: () => req("/auth/logout", { method: "POST", body: JSON.stringify({}) }),
  stats: (): Promise<{
    totalJobs: number;
    byStatus: Record<string, number>;
    totalEmails: number;
    sentEmails: number;
  }> => req("/api/stats"),
  jobs: (params: { status?: string; q?: string; page?: number } = {}) => {
    const sp = new URLSearchParams();
    if (params.status) sp.set("status", params.status);
    if (params.q) sp.set("q", params.q);
    if (params.page) sp.set("page", String(params.page));
    const qs = sp.toString();
    return req(`/api/jobs${qs ? `?${qs}` : ""}`) as Promise<{
      jobs: Job[];
      total: number;
      page: number;
      pageSize: number;
    }>;
  },
  createJob: (payload: {
    subject: string;
    body: string;
    to: string[];
    scheduledAt: string;
    idempotencyKey?: string;
  }) =>
    req("/api/jobs", { method: "POST", body: JSON.stringify(payload) }) as Promise<{
      job: Job;
      deduplicated: boolean;
    }>,
  cancelJob: (id: string) =>
    req(`/api/jobs/${id}/cancel`, { method: "DELETE" }) as Promise<{ job: Job }>,
};

export type JobStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled"
  | "partial";

export interface EmailLog {
  id: string;
  toEmail: string;
  status: "queued" | "sent" | "failed";
  previewUrl?: string | null;
  error?: string | null;
  sentAt?: string | null;
}

export interface Job {
  id: string;
  idempotencyKey: string;
  subject: string;
  bodyHtml: string;
  scheduledAt: string;
  status: JobStatus;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  logs: EmailLog[];
}

export function googleLoginUrl(): string {
  return `${API_URL}/auth/google`;
}
