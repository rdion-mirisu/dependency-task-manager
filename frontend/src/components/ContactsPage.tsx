import React from "react";
import { ContactsAPI, Contact as ContactType } from "../api/tasks";

export type Contact = {
  id: number | string;
  name: string;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
};

const phoneRegex = /^[\+]?[0-9\s\-\(\)]{7,15}$/;

export function ContactsPage() {
  const [contacts, setContacts] = React.useState<ContactType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<Partial<Contact>>({ name: "", phone: "", email: "", organization: "" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const load = () => {
    setError(null);
    setLoading(true);
    ContactsAPI.list()
      .then((data) => setContacts(data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, []);

  const validatePhone = (phone?: string | null) => {
    if (!phone) return true;
    return phoneRegex.test(phone);
  };

  const resetForm = () => {
    setForm({ name: "", phone: "", email: "", organization: "" });
    setEditingId(null);
    setFormError(null);
  };

  const openModal = (contact?: Contact) => {
    if (contact) {
      setEditingId(Number(contact.id));
      setForm({ name: contact.name, phone: contact.phone || "", email: contact.email || "", organization: contact.organization || "" });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name || !form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!validatePhone(form.phone)) {
      setFormError("Invalid phone number");
      return;
    }
    try {
      if (editingId != null) {
        await ContactsAPI.update(editingId, form);
      } else {
        await ContactsAPI.create(form);
      }
      closeModal();
      load();
      window.dispatchEvent(new Event('contacts-changed'));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const beginEdit = (c: Contact) => {
    openModal(c);
  };

  const deleteContact = async (id: number | string) => {
    if (!window.confirm("Delete this contact?")) return;
    try {
      await ContactsAPI.delete(id);
      load();
      window.dispatchEvent(new Event('contacts-changed'));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Contacts</h1>

      {loading && <p className="loading">Loading…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      <button className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={() => openModal()}>
        Add Contact
      </button>

      {/* modal form for add/edit */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{editingId ? "Edit Contact" : "Add Contact"}</h3>
            <form onSubmit={submit}>
              <div className="input-group">
                <label>Name *</label>
                <input
                  className="input"
                  value={form.name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="input-group">
                <label>Phone</label>
                <input
                  className="input"
                  value={form.phone || ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
                {!validatePhone(form.phone) && (
                  <div className="alert alert-error">Invalid phone number</div>
                )}
              </div>
              <div className="input-group">
                <label>Email</label>
                <input
                  className="input"
                  value={form.email || ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="input-group">
                <label>Organization</label>
                <input
                  className="input"
                  value={form.organization || ""}
                  onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                />
              </div>
              {formError && <div className="alert alert-error">{formError}</div>}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? "Save" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Org</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={String(c.id)}>
                  <td>{c.name}</td>
                  <td>{c.phone || "—"}</td>
                  <td>{c.email || "—"}</td>
                  <td>{c.organization || "—"}</td>
                  <td>
                    <button className="btn btn-ghost" onClick={() => beginEdit(c)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => deleteContact(c.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
