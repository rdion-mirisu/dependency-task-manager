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
  const [contactName, setContactName] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);

  const waitingISO = task.waiting_started_at ?? null;
  const waitingMs = task.status === "waiting" && waitingISO ? now - Date.parse(waitingISO) : 0;
  const taskId = String(task.id);

  async function updateStatus(
    next: TaskStatus,
    contact_name?: string,
    department?: string,
    contact_phone?: string,
    waiting_reason?: string
  ) {
    setUpdating(true);
    try {
      const payload: { status: TaskStatus; contact_name?: string; department?: string; contact_phone?: string; waiting_reason?: string } = { status: next };
      if (next === "waiting") {
        if (contact_name) payload.contact_name = contact_name;
        if (department) payload.department = department;
        if (contact_phone) payload.contact_phone = contact_phone;
        if (waiting_reason) payload.waiting_reason = waiting_reason;
      }
      await TasksAPI.patch(taskId, payload);
      setPendingWaiting(false);
      setContactName("");
      setDepartment("");
      setReason("");
      setToast("Task is now Waiting");
      setTimeout(() => setToast(null), 3000);
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(msg);
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
    if (!contactName.trim() || !department.trim() || !reason.trim()) {
      alert("Name, department and reason are required for waiting");
      return;
    }
    updateStatus(
      "waiting",
      contactName.trim(),
      department.trim(),
      contactPhone.trim() || undefined,
      reason.trim()
    );
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
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            {task.category} · {task.urgency}
          </div>
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
          {toast && <div className="toast toast-success" style={{ marginLeft: "1rem" }}>{toast}</div>}
        </div>
      </div>

      {task.description && (
        <p style={{ margin: "0.75rem 0 0", color: "var(--text-muted)", fontSize: "0.9375rem" }}>{task.description}</p>
      )}

      {pendingWaiting && (
        <div className="card card-body" style={{ marginTop: "1rem", background: "var(--bg)" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Set to Waiting — enter contact info
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="input-group" style={{ marginBottom: 0, flex: "1", minWidth: "120px" }}>
              <label>Contact Name *</label>
              <input
                type="text"
                className="input"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Name"
                disabled={updating}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0, flex: "1", minWidth: "120px" }}>
              <label>Department *</label>
              <input
                type="text"
                className="input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Dept."
                disabled={updating}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0, flex: "1", minWidth: "120px" }}>
              <label>Phone</label>
              <input
                type="tel"
                className="input"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. +15551234567"
                disabled={updating}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0, flex: "2", minWidth: "140px" }}>
              <label>Reason *</label>
              <input
                type="text"
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why waiting?"
                disabled={updating}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={submitWaiting} disabled={updating || !contactName || !department || !reason}>
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
              Reason: {task.waiting_info.reason || "—"} · Contact: {task.waiting_info.contact_name || "—"} · Dept: {task.waiting_info.department || "—"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
