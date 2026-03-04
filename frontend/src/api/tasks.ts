export type TaskStatus = "Active" | "Waiting" | "Completed";

export type WaitingDetails = {
  contactName?: string;      // person/department name
  contactPhone?: string;     // optional
  department?: string;       // optional (if you use dept instead)
};

export type Task = {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;           // e.g. Low/Medium/High or numeric
  status: TaskStatus;

  // IMPORTANT for waiting duration:
  waitingSince?: string;     // ISO timestamp when task entered Waiting
  updatedAt?: string;        // fallback if waitingSince not provided
  waitingDetails?: WaitingDetails;
};

export type CreateTaskPayload = {
  title: string;
  description: string;
  category: string;
  urgency: string;
  status?: TaskStatus;               // default "Active"
  waitingDetails?: WaitingDetails;   // usually empty on create
};

export type PatchTaskPayload = Partial<{
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: TaskStatus;
  waitingSince: string | null;
  waitingDetails: WaitingDetails | null;
}>;

// Simple in-memory auth token store.
// The login helper below will set this, and all requests will
// automatically include it while the app is running.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
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
  list: () => request<Task[]>("/api/tasks"),

  // optional: list waiting using spec filter GET /api/tasks?status=waiting
  listFiltered: (filter: string) =>
    request<Task[]>(`/api/tasks?status=${encodeURIComponent(filter)}`),

  create: (payload: CreateTaskPayload) =>
    request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  patch: (id: string, payload: PatchTaskPayload) =>
    request<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/api/tasks/${id}`, { method: "DELETE" }),
};
