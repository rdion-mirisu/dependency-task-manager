import React from "react";
import { TasksAPI, Task, TaskStatus } from "../api/tasks";
import { Link } from "react-router-dom";
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
    // deletion endpoint does not care about whether the task is assigned to a
    // category; we send only the id and let the server handle it.
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

  // determine badge color for priority
  const priorityColor = task.priority === "High" ? "#e74c3c" : task.priority === "Medium" ? "#f1c40f" : "#7f8c8d";

  return (
    <div className="card card-body" style={{ borderLeft: "4px solid " + task.color_code }}>
      {toast && <div className="toast toast-success" style={{ marginBottom: '0.5rem' }}>{toast}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to={`/tasks/${taskId}`} style={{ fontSize: '1.125rem', fontWeight: 600, textDecoration: 'none', color: 'var(--text)' }}>
          {task.title}
        </Link>
        <div className={statusChipClass}>{task.status}</div>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
        {task.category}{task.category_id ? ` (#${task.category_id})` : ''} · {task.priority}
      </div>
      {task.status === 'waiting' && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Waiting {formatDuration(waitingMs)}
        </div>
      )}

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={task.status} onChange={handleStatusChange} disabled={updating} className="input" style={{ width: 'auto' }}>
          <option value="active">Active</option>
          <option value="waiting">Waiting</option>
          <option value="completed">Completed</option>
        </select>
        {pendingWaiting && (
          <>
            <input
              type="text"
              placeholder="Contact name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="input"
            />
            <input
              type="text"
              placeholder="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="input"
            />
            <textarea
              placeholder="Reason"
              rows={1}
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button className="btn btn-primary" onClick={submitWaiting} disabled={updating}>
              Submit
            </button>
          </>
        )}
        <button className="btn btn-danger" onClick={deleteTask} disabled={deleting}>
          Delete
        </button>
      </div>
    </div>
  );
}
