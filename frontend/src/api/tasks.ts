export type TaskStatus = "active" | "waiting" | "completed";

export type Category = {
  id: number | string;
  name: string;
};

export type WaitingInfo = {
  reason?: string;
  contact_name?: string;
  department?: string;
  wait_start_per_date?: string;
  contact_id?: number | null;
};

// priority and color were recently added on the backend; include them everywhere
export type Task = {
  id: number | string;
  title: string;
  category: string;
  category_id?: number | null;
  // legacy field; mirrors priority for compatibility
  urgency: string;
  description: string | null;
  status: TaskStatus;
  priority: "High" | "Medium" | "Low";
  color_code: string; // hex string like "#ffffff"
  deadline?: string | null;
  contact_id?: number | null;
  total_wait_duration?: number | null;
  waiting_started_at?: string | null;
  waiting_ended_at?: string | null;
  waiting_info?: WaitingInfo | null;
};

export type CreateTaskPayload = {
  title: string;
  // urgency is optional and derived from priority
  urgency?: string;
  description: string;
  status?: TaskStatus; // default to "active" on server
  deadline?: string | null;
  contact_id?: number | null;
  priority?: "High" | "Medium" | "Low";
  color_code?: string;
  category_id?: number;
  // keep plain category string for backwards compatibility
  category?: string;
};

export type PatchTaskPayload = Partial<{
  title: string;
  category: string;
  // urgency may be provided, but priority updates automatically
  urgency: string;
  description: string | null;
  status: TaskStatus;
  deadline: string | null;
  contact_id: number;
  contact_name: string;
  department: string;
  waiting_reason: string;
  priority: "High" | "Medium" | "Low";
  color_code: string;
  category_id: number;
}>;

export type HistoryEntry = {
  id: number | string;
  action: string;
  actor: string | null;
  details: string | null;
  timestamp: string;
};

// token is persisted in localStorage; the axios interceptor
// will append it to each request.  This helper mirrors the
// previous behaviour so callers don't need to change.

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
  // accept optional filters for priority, status, and category_id
  list: async (filters?: { priority?: string; status?: string; category_id?: number }) => {
    let path = "/api/tasks";
    if (filters) {
      const qp = new URLSearchParams();
      if (filters.priority) qp.append("priority", filters.priority);
      if (filters.status) qp.append("status", filters.status);
      if (filters.category_id != null) qp.append("category_id", String(filters.category_id));
      const qs = qp.toString();
      if (qs) {
        path += `?${qs}`;
      }
    }
    // The backend currently returns { tasks: Task[] }.  Be defensive in case
    // we accidentally get a plain array or some other shape.
    const raw = await request<any>(path);
    if (Array.isArray(raw)) {
      return raw as Task[];
    }
    if (raw && Array.isArray(raw.tasks)) {
      return raw.tasks as Task[];
    }
    // unexpected response, fall back to empty list
    return [];
  },
  getHistory: (id: string) =>
    request<{ history: HistoryEntry[] }>(`/api/tasks/${id}/history`),
  get: (id: string) =>
    request<{ task: Task }>(`/api/tasks/${id}`),

  listFiltered: async (filter: string) => {
    // legacy helper for status-based filtering
    const raw = await request<any>(
      `/api/tasks?status=${encodeURIComponent(filter)}`
    );
    if (Array.isArray(raw)) {
      return raw as Task[];
    }
    if (raw && Array.isArray(raw.tasks)) {
      return raw.tasks as Task[];
    }
    return [];
  },

  listByPriority: async (priority: string) => {
    // server expects ?priority=High|Medium|Low
    const raw = await request<any>(
      `/api/tasks?priority=${encodeURIComponent(priority)}`
    );
    if (Array.isArray(raw)) {
      return raw as Task[];
    }
    if (raw && Array.isArray(raw.tasks)) {
      return raw.tasks as Task[];
    }
    return [];
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

export function getAverageWaitByContact() {
  return request<Array<{
    contact_name: string;
    average_wait_hours: number;
    total_tasks: number;
  }>>("/api/analytics/average-wait-by-contact");
}

export function getAverageWaitByUser() {
  return request<Array<{
    username: string;
    average_wait_hours: number;
    total_tasks: number;
  }>>("/api/analytics/average-wait-by-user");
}

export function exportAnalyticsCsv() {
  // this endpoint returns a file download; use axios client so auth header
  // is automatically included.  callers will need to handle the blob.
  return client.get("/api/analytics/export-csv", { responseType: 'blob' });
}

// admin-specific operations
export const CategoriesAPI = {
  list: async (): Promise<Category[]> => {
    const data = await request<{ categories: Category[] }>("/api/categories");
    return data.categories;
  },
  create: async (name: string): Promise<Category> => {
    const data = await request<{ category: Category }>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return data.category;
  },
  update: async (id: number | string, name: string): Promise<Category> => {
    const data = await request<{ category: Category }>(`/api/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    return data.category;
  },
  delete: async (id: number | string): Promise<void> => {
    await request<{ message: string }>(`/api/categories/${id}`, {
      method: "DELETE",
    });
  },
};

export type Contact = {
  id: number | string;
  name: string;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
};

export const ContactsAPI = {
  list: async (): Promise<Contact[]> => {
    // backend returns raw array of contacts rather than a wrapper object
    const data = await request<Contact[]>("/api/contacts");
    return data;
  },
  create: async (payload: Partial<Contact>): Promise<Contact> => {
    const data = await request<{ contact: Contact }>("/api/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.contact;
  },
  update: async (id: number | string, payload: Partial<Contact>): Promise<Contact> => {
    const data = await request<{ contact: Contact }>(`/api/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return data.contact;
  },
  delete: async (id: number | string): Promise<void> => {
    await request<{ message: string }>(`/api/contacts/${id}`, { method: "DELETE" });
  },
};

export const AdminAPI = {
  listTasks: () => request<any[]>("/api/admin/tasks"),
  listHistory: () => request<{ history: HistoryEntry[] }>("/api/admin/history"),
  updateStatus: (id: string, status: string) =>
    request<any>(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  sendSms: (id: string, message: string) =>
    request<any>(`/api/admin/tasks/${id}/sms`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

// calendar/export helper
export async function exportICal() {
  // use axios to simplify header handling and error detection
  const resp = await client.get("/api/integration/ical/export", { responseType: 'blob' });
  return resp.data;
}

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
  const token = localStorage.getItem("token");
  const p = parseJwt(token);
  return !!p?.is_admin;
}
