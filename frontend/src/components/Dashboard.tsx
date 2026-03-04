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
      const data = await TasksAPI.list(); // GET /api/tasks
      setTasks(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { Active: 0, Waiting: 0, Completed: 0 };
    for (const t of tasks) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return c as { Active: number; Waiting: number; Completed: number };
  }, [tasks]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
      <h1>Dashboard</h1>

      <CreateTaskForm onCreated={(newTask) => setTasks([...tasks, newTask])} />

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          marginTop: 24,
          flexWrap: "wrap",
        }}
      >
        <StatCard label="Active" value={counts.Active} color="#4CAF50" />
        <StatCard label="Waiting" value={counts.Waiting} color="#FFC107" />
        <StatCard label="Completed" value={counts.Completed} color="#2196F3" />
      </div>

      {/* Simple visualization bar */}
      <StatusBar counts={counts} />

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      {/* render tasks list */}
      {!loading && tasks.length === 0 && <p>No tasks yet. Create one above!</p>}
      {!loading &&
        tasks.map((t) => (
          <TaskCard key={t.id} task={t} onChanged={load} onDeleted={() => load()} />
        ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 10,
        minWidth: 120,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? "#333" }}>
        {value}
      </div>
    </div>
  );
}

function StatusBar({
  counts,
}: {
  counts: { Active: number; Waiting: number; Completed: number };
}) {
  const total = counts.Active + counts.Waiting + counts.Completed || 1;
  const a = (counts.Active / total) * 100;
  const w = (counts.Waiting / total) * 100;
  const c = (counts.Completed / total) * 100;

  return (
    <div
      style={{
        height: 10,
        display: "flex",
        borderRadius: 999,
        overflow: "hidden",
        border: "1px solid #eee",
        marginBottom: 16,
      }}
    >
      <div style={{ width: `${a}%`, background: "#4CAF50" }} title="Active" />
      <div style={{ width: `${w}%`, background: "#FFC107" }} title="Waiting" />
      <div style={{ width: `${c}%`, background: "#2196F3" }} title="Completed" />
    </div>
  );
}
