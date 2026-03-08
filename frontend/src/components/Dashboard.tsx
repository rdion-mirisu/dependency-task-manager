import React from "react";
import { TasksAPI, Task } from "../api/tasks";
import { TaskCard } from "./TaskCard";
import { CreateTaskForm } from "./CreateTaskForm";

export function Dashboard() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await TasksAPI.list();
      setTasks(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { active: 0, waiting: 0, completed: 0 };
    for (const t of tasks) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return c as { active: number; waiting: number; completed: number };
  }, [tasks]);

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      <section className="card card-body" style={{ marginBottom: "1.5rem" }}>
        <CreateTaskForm onCreated={(newTask) => setTasks((prev) => [...prev, newTask])} />
      </section>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <StatCard label="Active" value={counts.active} color="var(--status-active)" />
        <StatCard label="Waiting" value={counts.waiting} color="var(--status-waiting)" />
        <StatCard label="Completed" value={counts.completed} color="var(--status-completed)" />
      </div>

      <StatusBar counts={counts} />

      {loading && <p className="loading">Loading tasks…</p>}
      {error && <div className="alert alert-error">Error: {error}</div>}

      {!loading && tasks.length === 0 && (
        <div className="card card-body empty-state">
          No tasks yet. Create one above to get started.
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {tasks.map((t) => (
            <li key={String(t.id)}>
              <TaskCard task={t} onChanged={load} onDeleted={load} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="card card-body" style={{ minWidth: "120px", textAlign: "center" }}>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

function StatusBar({ counts }: { counts: { active: number; waiting: number; completed: number } }) {
  const total = counts.active + counts.waiting + counts.completed || 1;
  const a = (counts.active / total) * 100;
  const w = (counts.waiting / total) * 100;
  const c = (counts.completed / total) * 100;

  return (
    <div
      style={{
        height: "10px",
        display: "flex",
        borderRadius: "999px",
        overflow: "hidden",
        border: "1px solid var(--border)",
        marginBottom: "1.5rem",
        background: "var(--bg)",
      }}
    >
      <div style={{ width: `${a}%`, background: "var(--status-active)" }} title="Active" />
      <div style={{ width: `${w}%`, background: "var(--status-waiting)" }} title="Waiting" />
      <div style={{ width: `${c}%`, background: "var(--status-completed)" }} title="Completed" />
    </div>
  );
}
