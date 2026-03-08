import React from "react";
import { AdminAPI } from "../api/tasks";

type AdminTask = {
  id: number | string;
  title: string;
  owner: string;
  contact_name: string | null;
  status: string;
  hours_waiting: number | null;
};

export function AdminPanel() {
  const [tasks, setTasks] = React.useState<AdminTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [smsModal, setSmsModal] = React.useState<{ taskId: string; contactName: string } | null>(null);
  const [smsText, setSmsText] = React.useState("");

  const load = () => {
    setError(null);
    setLoading(true);
    AdminAPI.listTasks()
      .then((t) => setTasks(t))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, []);

  const changeStatus = (id: string, status: string) => {
    AdminAPI.updateStatus(id, status)
      .then(() => load())
      .catch((e: unknown) => alert("Failed to update status: " + (e instanceof Error ? e.message : "Error")));
  };

  const openSms = (taskId: string, contactName: string) => {
    setSmsModal({ taskId, contactName });
    setSmsText("");
  };

  const sendSms = () => {
    if (smsModal) {
      alert(`SMS to ${smsModal.contactName}: ${smsText}`);
      setSmsModal(null);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Admin Panel</h1>

      {loading && <p className="loading">Loading…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Owner</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Hours waiting</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={String(t.id)}>
                    <td>{t.title}</td>
                    <td>{t.owner}</td>
                    <td>{t.contact_name || "—"}</td>
                    <td>
                      <select
                        className="input"
                        value={t.status}
                        onChange={(e) => changeStatus(String(t.id), e.target.value)}
                        style={{ width: "auto", minWidth: "100px" }}
                      >
                        <option value="active">Active</option>
                        <option value="waiting">Waiting</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td>{t.hours_waiting != null ? t.hours_waiting.toFixed(2) : "—"}</td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => openSms(String(t.id), t.contact_name || "")}>
                        Send SMS
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tasks.length === 0 && <div className="empty-state">No tasks to show.</div>}
        </>
      )}

      {smsModal && (
        <div className="modal-overlay" onClick={() => setSmsModal(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Send SMS to {smsModal.contactName}</h3>
            <textarea
              className="input"
              rows={4}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              placeholder="Message…"
            />
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setSmsModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={sendSms}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
