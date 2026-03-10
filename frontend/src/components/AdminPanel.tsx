import React from "react";
import { AdminAPI, HistoryEntry } from "../api/tasks";

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
  const [toast, setToast] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState<string>("");
  const [historySearch, setHistorySearch] = React.useState<string>("");

  // history data for admin
  const [historyEntries, setHistoryEntries] = React.useState<Array<any>>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [historyPage, setHistoryPage] = React.useState(1);
  const HISTORY_PAGE_SIZE = 20;

  const load = () => {
    setError(null);
    setLoading(true);
    AdminAPI.listTasks()
      .then((t) => setTasks(t))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  const loadHistory = () => {
    setHistoryError(null);
    setHistoryLoading(true);
    AdminAPI.listHistory()
      .then((res) => setHistoryEntries(res.history))
      .catch((e: unknown) => setHistoryError(e instanceof Error ? e.message : "Failed to load history"))
      .finally(() => setHistoryLoading(false));
  };

  React.useEffect(() => {
    load();
    loadHistory();
  }, []);

  const changeStatus = (id: string, status: string) => {
    AdminAPI.updateStatus(id, status)
      .then(() => {
        load();
        setToast("Status updated");
        setTimeout(() => setToast(null), 3000);
      })
      .catch((e: unknown) => {
        alert("Failed to update status: " + (e instanceof Error ? e.message : "Error"));
      });
  };

  const openSms = (taskId: string, contactName: string) => {
    setSmsModal({ taskId, contactName });
    setSmsText("");
  };

  const sendSms = () => {
    if (smsModal) {
      AdminAPI.sendSms(smsModal.taskId, smsText)
        .then((res) => {
          if ((res as any).warning) {
            setToast("Contact has no phone number, SMS notification skipped.");
          } else {
            setToast("SMS sent successfully");
          }
          setTimeout(() => setToast(null), 3000);
          setSmsModal(null);
        })
        .catch((e: unknown) => {
          alert("Failed to send SMS: " + (e instanceof Error ? e.message : "Error"));
          setSmsModal(null);
        });
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Admin Panel</h1>

      {loading && <p className="loading">Loading…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label>Search</label>
            <input
              className="input"
              type="text"
              placeholder="Filter by title or owner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

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
                {tasks
                  .filter((t) => {
                    if (!search) return true;
                    const q = search.toLowerCase();
                    return (
                      t.title.toLowerCase().includes(q) ||
                      t.owner.toLowerCase().includes(q)
                    );
                  })
                  .map((t) => (
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

          {/* history section */}
          <h2 style={{ marginTop: '2rem' }}>Task History</h2>
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label>Search</label>
            <input
              className="input"
              type="text"
              placeholder="Filter history by task or actor"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>
          {historyLoading && <p className="loading">Loading…</p>}
          {historyError && <div className="alert alert-error">{historyError}</div>}
          {!historyLoading && !historyError && (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Details</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyEntries
                      .filter((h) => {
                        if (!historySearch) return true;
                        const q = historySearch.toLowerCase();
                        return (
                          (h.task_title || '').toLowerCase().includes(q) ||
                          (h.actor || '').toLowerCase().includes(q)
                        );
                      })
                      .slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
                      .map((h) => (
                        <tr key={String(h.id)}>
                          <td>{h.task_title}</td>
                          <td>{h.action}</td>
                          <td>{h.actor}</td>
                          <td>{h.details}</td>
                          <td>{new Date(h.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {historyEntries.length === 0 && <div className="empty-state">No history entries.</div>}
              {historyEntries.length > HISTORY_PAGE_SIZE && (
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button
                    className="btn btn-ghost"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span>Page {historyPage}</span>
                  <button
                    className="btn btn-ghost"
                    disabled={historyPage * HISTORY_PAGE_SIZE >= historyEntries.length}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {toast && <div className="toast toast-success" style={{ marginBottom: '1rem' }}>{toast}</div>}
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
