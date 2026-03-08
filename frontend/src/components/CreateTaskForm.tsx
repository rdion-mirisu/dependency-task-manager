import React from "react";
import { TasksAPI, CreateTaskPayload, Task } from "../api/tasks";

export function CreateTaskForm({ onCreated }: { onCreated: (task: Task) => void }) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [deadline, setDeadline] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setLoading(true);
    try {
      const payload: CreateTaskPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        status: "active",
        deadline: deadline ? new Date(deadline).toISOString() : null,
      };
      const created = await TasksAPI.create(payload);
      onCreated(created);
      setTitle("");
      setDescription("");
      setDeadline(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700 }}>Create New Task</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="input-group">
        <label>Title *</label>
        <input
          type="text"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          placeholder="What needs to be done?"
          required
        />
      </div>
      <div className="input-group">
        <label>Description</label>
        <textarea
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          placeholder="Add more details…"
          rows={3}
        />
      </div>
      <div className="input-group">
        <label>Deadline (optional)</label>
        <input
          type="datetime-local"
          className="input"
          value={deadline ?? ""}
          onChange={(e) => setDeadline(e.target.value || null)}
          disabled={loading}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Creating…" : "Create Task"}
      </button>
    </form>
  );
}
