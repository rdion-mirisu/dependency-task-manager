export type TaskStatus = "active" | "waiting" | "completed";

export type WaitingInfo = {
  reason?: string;
  contact_name?: string;
  department?: string;
  wait_start_per_date?: string;
};

export type Task = {
  id: number | string;
  title: string;
  category: string;
  urgency: string;
  description: string | null;
  status: TaskStatus;
  deadline?: string | null;
  total_wait_duration?: number | null;
  waiting_started_at?: string | null;
  waiting_ended_at?: string | null;
  waiting_info?: WaitingInfo | null;
};

export type CreateTaskPayload = {
  title: string;
  category: string;
  urgency: string;
  description: string;
  status?: TaskStatus; // default to "active" on server
  deadline?: string | null;
};

export type PatchTaskPayload = Partial<{
  title: string;
  category: string;
  urgency: string;
  description: string | null;
  status: TaskStatus;
  deadline: string | null;
  contact_name: string;
  department: string;
  waiting_reason: string;
}>;

// token is persisted in localStorage; the axios interceptor
// will append it to each request.  This helper mirrors the
// previous behaviour so callers don't need to change.
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? "";

import client from "./client";
import axios from "axios";

function getNetworkErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg === "Failed to fetch" ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed") ||
    msg.includes("connection")
  ) {
    return "Cannot reach the server. Make sure the backend is running (e.g. on port 5000).";
  }
  return msg;
}

// helper that mimics the old fetch-based API for simplicity
async function request<T>(path: string, options: { method?: string; headers?: any; body?: any } = {}): Promise<T> {
  try {
    const response = await client.request<T>({
      url: path,
      method: options.method as any,
      data: options.body,
      headers: options.headers,
    });
    return response.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.response) {
        let message = "";
        const data = err.response.data;
        if (data && typeof data === "object" && typeof data.message === "string") {
          message = data.message;
        } else if (typeof data === "string") {
          message = data;
        } else {
          message = err.response.statusText;
        }
        throw new Error(message);
      }
      if (err.request) {
        throw new Error(getNetworkErrorMessage(err));
      }
    }
    throw new Error(getNetworkErrorMessage(err));
  }
}

// --- Auth helpers (login & register) ---
// Call this from the UI to log in using the backend's /api/auth/login route.
// On success it stores the JWT so all subsequent calls are authenticated.
export async function login(email: string, password: string): Promise<string> {
  const data = await request<{ access_token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  setAuthToken(data.access_token);
  return data.access_token;
}

// Call this from the UI to register a new user with /api/auth/register.
// It only creates the account; the user still logs in afterward.
export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<void> {
  await request<{ message: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export const TasksAPI = {
  // Backend returns { tasks: Task[] }; unwrap for callers
  list: async () => {
    const data = await request<{ tasks: Task[] }>("/api/tasks");
    return data.tasks;
  },

  listFiltered: async (filter: string) => {
    const data = await request<{ tasks: Task[] }>(
      `/api/tasks?status=${encodeURIComponent(filter)}`
    );
    return data.tasks;
  },

  create: async (payload: CreateTaskPayload) => {
    const data = await request<{ task: Task }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.task;
  },

  patch: (id: string, payload: PatchTaskPayload) =>
    request<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/api/tasks/${id}`, { method: "DELETE" }),
};

// analytics helper
export function getAverageWait() {
  return request<Array<{
    contact_name: string;
    average_wait_hours: number;
    total_tasks: number;
  }>>("/api/analytics/average-wait");
}

// admin-specific operations
export const AdminAPI = {
  listTasks: () => request<any[]>("/api/admin/tasks"),
  updateStatus: (id: string, status: string) =>
    request<any>(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// integration helpers
export const IntegrationAPI = {
  // GET returns { auth_url }
  connectGoogle: () => request<{ auth_url: string }>("/api/integration/google/oauth", {
    method: "POST",
  }),
  // POST with {code} to exchange tokens
  finalizeGoogle: (code: string) =>
    request<{ message: string }>("/api/integration/google/oauth", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  syncGoogle: () =>
    request<{ created_event_ids: string[] }>("/api/integration/google/sync"),
  exportICal: async () => {
    const res = await fetch(`${API_BASE}/api/integration/ical/export`, {
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${txt || res.statusText}`);
    }
    return res.blob();
  },
};

// simple JWT parser
export function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getIsAdmin() {
  const p = parseJwt(authToken);
  return !!p?.is_admin;
}
