import React from "react";
import { useParams } from "react-router-dom";
import { TasksAPI, ContactsAPI, CategoriesAPI, Contact as ContactType, Category } from "../api/tasks";

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [contacts, setContacts] = React.useState<ContactType[]>([]);
  const [assignId, setAssignId] = React.useState<string | number | undefined>(undefined);

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | null>(null);

  const [forwardModal, setForwardModal] = React.useState<{ contactId?: number; note: string } | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  // editing/ form state
  const [editing, setEditing] = React.useState(false);
  const [formTitle, setFormTitle] = React.useState<string>("");
  const [formDescription, setFormDescription] = React.useState<string>("");
  const [formDeadline, setFormDeadline] = React.useState<string>("");
  const [formUrgency, setFormUrgency] = React.useState<string>("");
  const [formPriority, setFormPriority] = React.useState<"High"|"Medium"|"Low">("Low");
  const [formColor, setFormColor] = React.useState<string>("#808080");

  // history data
  const [history, setHistory] = React.useState<Array<any>>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  const loadHistory = React.useCallback(async () => {
    if (!id) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await TasksAPI.getHistory(id);
      setHistory(res.history);
    } catch (e: unknown) {
      setHistoryError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  const load = React.useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const res = await TasksAPI.get(id);
      setTask(res.task);
      // prefer direct contact_id property if present, otherwise fall back to waiting_info
      const cid = res.task.contact_id ?? res.task.waiting_info?.contact_id;
      if (cid != null) {
        setAssignId(cid);
      }
      if (res.task.category_id != null) {
        setSelectedCategoryId(res.task.category_id);
      } else {
        setSelectedCategoryId(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadContacts = React.useCallback(async () => {
    try {
      const list = await ContactsAPI.list();
      setContacts(list);
    } catch {}
  }, []);

  React.useEffect(() => {
    load();
    loadContacts();
    // fetch categories
    CategoriesAPI.list()
      .then((list) => setCategories(list))
      .catch(() => {});
    // listen for tasks-changed to refresh in case assignment/edit happens elsewhere
    const h = () => load();
    window.addEventListener('tasks-changed', h);
    // listen for contact changes so chooser stays in sync
    const ch = () => loadContacts();
    window.addEventListener('contacts-changed', ch);
    return () => {
      window.removeEventListener('tasks-changed', h);
      window.removeEventListener('contacts-changed', ch);
    };
  }, [load, loadContacts]);

  const changeAssignment = async (newId: string | number) => {
    try {
      await TasksAPI.patch(id!, { contact_id: Number(newId) });
      setToast("Contact assigned");
      setTimeout(() => setToast(null), 3000);
      load();
      window.dispatchEvent(new Event('tasks-changed'));
    } catch (e) {
      alert("Failed to assign contact: " + (e instanceof Error ? e.message : ""));
    }
  };

  const openForward = () => {
    setForwardModal({ contactId: undefined, note: "" });
  };

  const doForward = async () => {
    if (!forwardModal) return;
    if (!forwardModal.contactId) {
      alert("Select a contact to forward to");
      return;
    }
    try {
      await fetch(`/api/tasks/${id}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: forwardModal.contactId, reason: forwardModal.note }),
      });
      setToast("Task forwarded");
      setTimeout(() => setToast(null), 3000);
      setForwardModal(null);
      load();
      window.dispatchEvent(new Event('tasks-changed'));
    } catch (e) {
      alert("Failed to forward task");
    }
  };

  const startEditing = () => {
    if (!task) return;
    setFormTitle(task.title || "");
    setFormDescription(task.description || "");
    setFormDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0,16) : "");
    setFormUrgency(task.urgency || task.priority);
    setFormPriority(task.priority);
    setFormColor(task.color_code || "#808080");
    setSelectedCategoryId(task.category_id != null ? task.category_id : null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!task) return;
    try {
      const payload: any = {};
      if (formTitle !== task.title) payload.title = formTitle;
      if (formDescription !== task.description) payload.description = formDescription;
      if (formUrgency !== task.urgency) payload.urgency = formUrgency;
      if (formPriority !== task.priority) payload.priority = formPriority;
      if (formColor !== task.color_code) payload.color_code = formColor;
      if ((selectedCategoryId ?? null) !== (task.category_id ?? null)) payload.category_id = selectedCategoryId;
      if (formDeadline) {
        const iso = new Date(formDeadline).toISOString();
        if (iso !== task.deadline) payload.deadline = iso;
      } else if (task.deadline) {
        payload.deadline = null;
      }
      // always include status even if unchanged so backend logic remains simple
      if (!('status' in payload)) {
        payload.status = task.status;
      }
      await TasksAPI.patch(id!, payload);
      setToast("Task updated");
      setTimeout(() => setToast(null), 2000);
      setEditing(false);
      load();
      window.dispatchEvent(new Event('tasks-changed'));
    } catch (e) {
      alert("Failed to update: " + (e instanceof Error ? e.message : ""));
    }
  };

  if (loading) return <p className="loading">Loading…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!task) return <div>Task not found</div>;

  return (
    <div className="page">
      <h1 className="page-title">Task Details</h1>
      {toast && <div className="toast toast-success" style={{ marginBottom: '1rem' }}>{toast}</div>}
      <div className="card card-body" style={{ borderLeft: `4px solid ${task.color_code}`, position: 'relative' }}>
        {/* badge in top right */}
        <span
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            backgroundColor: task.priority === 'High' ? '#e74c3c' : task.priority === 'Medium' ? '#f1c40f' : '#7f8c8d',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.15rem 0.4rem',
            borderRadius: '3px',
            textTransform: 'uppercase',
          }}
        >
          {task.priority}
        </span>
        {editing ? (
          <div>
            <div className="input-group">
              <label>Title</label>
              <input
                className="input"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Description</label>
              <textarea
                className="input"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Urgency</label>
              <select
                className="input"
                value={formUrgency}
                onChange={(e) => setFormUrgency(e.target.value)}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="input-group">
              <label>Priority</label>
              <select
                className="input"
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as any)}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="input-group">
              <label>Deadline</label>
              <input
                type="datetime-local"
                className="input"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Category</label>
              <select
                className="input"
                value={selectedCategoryId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedCategoryId(v ? Number(v) : null);
                }}
              >
                <option value="">-- none --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Color</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {['#e74c3c', '#f1c40f', '#7f8c8d', '#3498db', '#2ecc71', '#808080'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormColor(c)}
                    style={{
                      backgroundColor: c,
                      width: '24px',
                      height: '24px',
                      border: formColor === c ? '2px solid #000' : '1px solid #ccc',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={saveEdit}>
                Save
              </button>
              <button className="btn btn-secondary" onClick={cancelEditing}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ margin: 0 }}>{task.title}</h2>
            <button
              className="btn btn-secondary btn-sm"
              style={{ position: 'absolute', top: '1rem', right: '4rem' }}
              onClick={startEditing}
            >
              Edit
            </button>
            <p style={{ color: 'var(--text-muted)' }}>{task.category} · {task.priority}</p>
            {task.deadline && <p>Deadline: {new Date(task.deadline).toLocaleString()}</p>}
            <p>{task.description}</p>
          </>
        )}

        <div style={{ marginTop: '1rem' }}>
          <label>Assigned Contact:</label>{' '}
          <select
            className="input"
            value={assignId || ''}
            onChange={(e) => {
              const val = e.target.value;
              changeAssignment(val ? Number(val) : '');
            }}
          >
            <option value="">-- none --</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button style={{ marginTop: '1rem' }} className="btn btn-ghost" onClick={openForward}>
          Forward Task
        </button>
      
      {/* history/details tab buttons */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button
          className={showHistory ? 'btn btn-ghost' : 'btn btn-primary'}
          onClick={() => setShowHistory(false)}
        >
          Details
        </button>
        <button
          className={showHistory ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={() => {
            if (!showHistory) {
              loadHistory();
            }
            setShowHistory(true);
          }}
        >
          History
        </button>
      </div>
      </div>

      {/* history section */}
      {showHistory ? (
        <div style={{ marginTop: '2rem' }}>
          {historyLoading && <p className="loading">Loading history…</p>}
          {historyError && <div className="alert alert-error">{historyError}</div>}
          {!historyLoading && !historyError && (
            <>
              {history.length === 0 ? (
                <div className="empty-state">No history yet</div>
              ) : (
                <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                  {history.map((h) => (
                    <li key={h.id} style={{ marginBottom: '1rem', borderLeft: '2px solid #ccc', paddingLeft: '0.5rem' }}>
                      <div>
                        <strong>{h.action.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</strong> by {h.actor || 'unknown'}
                      </div>
                      <div style={{ fontStyle: 'italic', color: '#555' }}>{h.details}</div>
                      <div style={{ fontSize: '0.85rem', color: '#888' }}>{new Date(h.timestamp).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : null}

      {forwardModal && (
        <div className="modal-overlay" onClick={() => setForwardModal(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Forward task</h3>
            <div className="input-group">
              <label>Contact</label>
              <select
                className="input"
                value={forwardModal.contactId || ''}
                onChange={(e) => setForwardModal((m) => ({ ...m!, contactId: Number(e.target.value) }))}
              >
                <option value="">-- select --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Note</label>
              <textarea
                className="input"
                rows={3}
                value={forwardModal.note}
                onChange={(e) => setForwardModal((m) => ({ ...m!, note: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setForwardModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={doForward}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
