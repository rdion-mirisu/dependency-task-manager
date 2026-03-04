import React from "react";
import { TasksAPI, CreateTaskPayload, Task } from "../api/tasks";

export function CreateTaskForm({
  onCreated,
}: {
  onCreated: (task: Task) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [urgency, setUrgency] = React.useState("Medium");
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
        description: description.trim(),
        category: category.trim() || "General",
        urgency: urgency,
        status: "Active", // default
      };

      const created = await TasksAPI.create(payload); // POST /api/tasks
      onCreated(created);

      // Reset form
      setTitle("");
      setDescription("");
      setCategory("");
      setUrgency("Medium");
    } catch (err) {
      setError((err as any).message ?? "Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        background: "#f9f9f9",
      }}
    >
      <h2>Create New Task</h2>

      {error && (
        <div style={{ color: "crimson", marginBottom: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
          Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          placeholder="What needs to be done?"
          style={{
            width: "100%",
            padding: 10,
            marginTop: 6,
            borderRadius: 4,
            border: "1px solid #ccc",
            boxSizing: "border-box",
            fontSize: 14,
          }}
          required
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          placeholder="Add more details..."
          rows={3}
          style={{
            width: "100%",
            padding: 10,
            marginTop: 6,
            borderRadius: 4,
            border: "1px solid #ccc",
            boxSizing: "border-box",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
            Category
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={loading}
            placeholder="e.g. Work, Personal"
            style={{
              width: "100%",
              padding: 10,
              marginTop: 6,
              borderRadius: 4,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
            Urgency
          </label>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            disabled={loading}
            style={{
              width: "100%",
              padding: 10,
              marginTop: 6,
              borderRadius: 4,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              fontSize: 14,
            }}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "10px 20px",
          background: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: 4,
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Creating..." : "Create Task"}
      </button>
    </form>
  );
}
