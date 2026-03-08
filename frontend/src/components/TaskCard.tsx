import React from "react";
import { TasksAPI, Task, TaskStatus } from "../api/tasks";
import { useNow } from "../utils/useNow";
import { formatDuration } from "../utils/waitingTime";

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
  const [pendingWaiting, setPendingWaiting] = React.useState(false);
  const [contactId, setContactId] = React.useState("");
  const [reason, setReason] = React.useState("");

  const waitingISO = task.waiting_started_at ?? null;
  const waitingMs = task.status === "waiting" && waitingISO ? now - Date.parse(waitingISO) : 0;
  const taskId = String(task.id);

  async function updateStatus(next: TaskStatus, contactIdNum?: number, reasonText?: string) {
    setUpdating(true);
    try {
      const payload: { status: TaskStatus; contact_id?: number; reason?: string } = { status: next };
      if (next === "waiting" && contactIdNum != null) {
        payload.contact_id = contactIdNum;
        if (reasonText != null) payload.reason = reasonText;
      }
      await TasksAPI.patch(taskId, payload);
      setPendingWaiting(false);
      setContactId("");
      setReason("");
      onChanged();
    } catch (err) {
      alert("Error updating status: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setUpdating(false);
    }
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as TaskStatus;
    if (next === "waiting") {
      setPendingWaiting(true);
      return;
    }
    updateStatus(next);
  }

  function submitWaiting() {
    const num = parseInt(contactId, 10);
    if (Number.isNaN(num) || num < 1) {
      alert("Please enter a valid Contact ID (positive number).");
      return;
    }
    updateStatus("waiting", num, reason || undefined);
  }

  async function deleteTask() {
    if (!window.confirm("Delete this task?")) return;
    setDeleting(true);
    try {
      await TasksAPI.delete(taskId);
      onDeleted();
    } catch (err) {
      alert("Error deleting task: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setDeleting(false);
    }
  }

  const statusChipClass = task.status === "active" ? "chip-active" : task.status === "waiting" ? "chip-waiting" : "chip-completed";

  return (
    <div className="card card-body">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1", minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>{task.title}</div>
          {task.deadline && (
            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Deadline: {new Date(task.deadline).toLocaleString()}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span className={`chip ${statusChipClass}`}>{task.status}</span>
          <select
            className="input"
            value={task.status}
            onChange={handleStatusChange}
            disabled={updating || deleting}
            style={{ width: "auto", minWidth: "110px" }}
          >
            <option value="active">Active</option>
            <option value="waiting">Waiting</option>
            <option value="completed">Completed</option>
          </select>
          <button type="button" className="btn btn-danger" onClick={deleteTask} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {task.description && (
        <p style={{ margin: "0.75rem 0 0", color: "var(--text-muted)", fontSize: "0.9375rem" }}>{task.description}</p>
      )}

      {pendingWaiting && (
        <div className="card card-body" style={{ marginTop: "1rem", background: "var(--bg)" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>Set to Waiting — enter contact</div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="input-group" style={{ marginBottom: 0, flex: "1", minWidth: "120px" }}>
              <label>Contact ID *</label>
              <input
                type="number"
                className="input"
                min={1}
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder="e.g. 1"
                disabled={updating}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0, flex: "2", minWidth: "140px" }}>
              <label>Reason (optional)</label>
              <input
                type="text"
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why waiting?"
                disabled={updating}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={submitWaiting} disabled={updating}>
              Confirm Waiting
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPendingWaiting(false)} disabled={updating}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {task.status === "waiting" && !pendingWaiting && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-sm)",
            background: "rgba(217, 119, 6, 0.08)",
            borderLeft: "4px solid var(--status-waiting)",
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            Waiting duration: <strong style={{ color: "var(--text)" }}>{waitingISO ? formatDuration(waitingMs) : "—"}</strong>
          </div>
          {task.waiting_info && (
            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Reason: {task.waiting_info.reason || "—"} · Contact ID: {task.waiting_info.contact_id ?? "—"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
