import React from "react";
import { TasksAPI, Task, CategoriesAPI, Category } from "../api/tasks";
import { TaskCard } from "./TaskCard";
import { CreateTaskForm } from "./CreateTaskForm";

export function Dashboard() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = React.useState<"All" | "High" | "Medium" | "Low">("All");
  // categoryFilter may be a numeric id, "All" for no filtering, or
  // "None" to show tasks with no assigned category.
  const [categoryFilter, setCategoryFilter] = React.useState<number | "All" | "None">("All");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [sortOption, setSortOption] = React.useState<"none" | "priority" | "deadline">("none");

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const filters: any = {};
      if (priorityFilter !== "All") filters.priority = priorityFilter;
      // only send a backend filter when we have a real numeric id; "None"
      // means we want unassigned tasks and is handled client-side below.
      if (typeof categoryFilter === 'number') {
        filters.category_id = categoryFilter;
      }
      let data = await TasksAPI.list(Object.keys(filters).length ? filters : undefined);

      if (categoryFilter === "None") {
        data = data.filter((t) => t.category_id == null);
      }
      setTasks(data);
      // notify any listeners (e.g. calendar page) that task list refreshed
      window.dispatchEvent(new Event('tasks-changed'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    // reload tasks when either filter changes
    load();
  }, [priorityFilter, categoryFilter]);

  // fetch category list once and whenever it changes elsewhere
  React.useEffect(() => {
    const loadCats = async () => {
      try {
        const list = await CategoriesAPI.list();
        setCategories(list);
      } catch {
        setCategories([]);
      }
    };
    loadCats();
    const handler = () => loadCats();
    window.addEventListener('categories-changed', handler);
    return () => window.removeEventListener('categories-changed', handler);
  }, []);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { active: 0, waiting: 0, completed: 0 };
    for (const t of tasks) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return c as { active: number; waiting: number; completed: number };
  }, [tasks]);

  // derive sorted/filtered list for rendering
  const displayedTasks = React.useMemo(() => {
    const arr = [...tasks];
    if (sortOption === "priority") {
      const order: Record<string, number> = { High: 1, Medium: 2, Low: 3 };
      arr.sort((a, b) => (order[a.priority] || 0) - (order[b.priority] || 0));
    } else if (sortOption === "deadline") {
      arr.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    }
    return arr;
  }, [tasks, sortOption]);

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      <section className="card card-body" style={{ marginBottom: "1.5rem" }}>
        <CreateTaskForm
          onCreated={(newTask) => {
            setTasks((prev) => [...prev, newTask]);
            window.dispatchEvent(new Event('tasks-changed'));
          }}
        />
      </section>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <StatCard label="Active" value={counts.active} color="var(--status-active)" />
        <StatCard label="Waiting" value={counts.waiting} color="var(--status-waiting)" />
        <StatCard label="Completed" value={counts.completed} color="var(--status-completed)" />
      </div>
      {/* filter and sort controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Filter by Priority</label>
          <select
            className="input"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
          >
            <option>All</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Filter by Category</label>
          <select
            className="input"
            value={categoryFilter}
            onChange={(e) => {
              const val = e.target.value;
              setCategoryFilter(val === "All" ? "All" : Number(val));
            }}
          >
            <option value="All">All</option>
          <option value="None">Unassigned</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Sort</label>
          <select
            className="input"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
          >
            <option value="none">None</option>
            <option value="priority">By Priority</option>
            <option value="deadline">By Deadline</option>
          </select>
        </div>
      </div>

      <StatusBar counts={counts} />

      {loading && <p className="loading">Loading tasks…</p>}
      {error && <div className="alert alert-error">Error: {error}</div>}

      {!loading && displayedTasks.length === 0 && (
        <div className="card card-body empty-state">
          No tasks yet. Create one above to get started.
        </div>
      )}

      {!loading && displayedTasks.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {displayedTasks.map((t) => (
            <li key={String(t.id)}>
              <TaskCard task={t} onChanged={() => load()} onDeleted={() => load()} />
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
