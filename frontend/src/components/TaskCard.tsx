import React from "react";
import { TasksAPI, Task, TaskStatus } from "../api/tasks";
import { useNow } from "../utils/useNow";
import { getWaitingStartISO, formatDuration } from "../utils/waitingTime";

export function TaskCard({
  task,
  onChanged,
  onDeleted,
}: {
  task: Task;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const now = useNow(60000);
  const [updating, setUpdating] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const waitingISO = getWaitingStartISO(task);
  const waitingMs =
    task.status === "Waiting" && waitingISO ? now - Date.parse(waitingISO) : 0;

  async function updateStatus(next: TaskStatus) {
    setUpdating(true);
    try {
      const payload: any = { status: next };

      if (next === "Waiting") {
        payload.waitingSince = task.waitingSince ?? new Date().toISOString();
        payload.waitingDetails = task.waitingDetails ?? { contactName: "" };
      } else {
        // leaving waiting -> clear waitingSince
        payload.waitingSince = null;
      }

      await TasksAPI.patch(task.id, payload); // PATCH /api/tasks/{id}
      onChanged();
    } catch (err) {
      alert("Error updating status: " + (err as any).message);
    } finally {
      setUpdating(false);
    }
  }

  async function updateWaitingDetails(waitingDetails: any) {
    setUpdating(true);
    try {
      await TasksAPI.patch(task.id, { waitingDetails }); // PATCH /api/tasks/{id}
      onChanged();
    } catch (err) {
      alert("Error updating details: " + (err as any).message);
    } finally {
      setUpdating(false);
    }
  }

  async function deleteTask() {
    if (!window.confirm("Delete this task?")) return;
    setDeleting(true);
    try {
      await TasksAPI.delete(task.id);
      onDeleted();
    } catch (err) {
      alert("Error deleting task: " + (err as any).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        background: "#fafafa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{task.title}</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            {task.category} • {task.urgency}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={task.status}
            onChange={(e) => updateStatus(e.target.value as TaskStatus)}
            disabled={updating || deleting}
            style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
          >
            <option value="Active">Active</option>
            <option value="Waiting">Waiting</option>
            <option value="Completed">Completed</option>
          </select>
          <button
            onClick={deleteTask}
            disabled={deleting}
            style={{
              padding: "8px 12px",
              background: "#ff5252",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <p style={{ marginTop: 8, opacity: 0.9 }}>{task.description}</p>

      {task.status === "Waiting" && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            background: "#fff8e1",
            borderLeft: "4px solid #FFC107",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Waiting Duration:{" "}
            <b>{waitingISO ? formatDuration(waitingMs) : "—"}</b>
          </div>

          {/* Waiting Details (person/department contact) */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="Contact / Department"
              value={task.waitingDetails?.contactName ?? ""}
              onChange={(e) =>
                updateWaitingDetails({
                  ...(task.waitingDetails ?? {}),
                  contactName: e.target.value,
                })
              }
              disabled={updating}
              style={{
                padding: 6,
                borderRadius: 4,
                border: "1px solid #ddd",
                flex: 1,
                minWidth: 150,
              }}
            />
            <input
              placeholder="Phone (optional)"
              value={task.waitingDetails?.contactPhone ?? ""}
              onChange={(e) =>
                updateWaitingDetails({
                  ...(task.waitingDetails ?? {}),
                  contactPhone: e.target.value,
                })
              }
              disabled={updating}
              style={{
                padding: 6,
                borderRadius: 4,
                border: "1px solid #ddd",
                flex: 1,
                minWidth: 150,
              }}
            />
            <input
              placeholder="Department (optional)"
              value={task.waitingDetails?.department ?? ""}
              onChange={(e) =>
                updateWaitingDetails({
                  ...(task.waitingDetails ?? {}),
                  department: e.target.value,
                })
              }
              disabled={updating}
              style={{
                padding: 6,
                borderRadius: 4,
                border: "1px solid #ddd",
                flex: 1,
                minWidth: 150,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
