import React from "react";
import { CategoriesAPI } from "../api/tasks";

export type Category = {
  id: number | string;
  name: string;
};

export function CategoriesPage() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [formName, setFormName] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const load = () => {
    setError(null);
    setLoading(true);
    CategoriesAPI.list()
      .then((data) => setCategories(data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, []);

  const openModal = (category?: Category) => {
    if (category) {
      // ids coming from the API are numeric but could also be strings, so
      // coerce to a number and treat NaN as null just in case.  We use a
      // strict non-null check elsewhere, so this ensures the modal properly
      // switches between "Add" and "Edit" states.
      const idNum = Number(category.id);
      setEditingId(Number.isNaN(idNum) ? null : idNum);
      setFormName(category.name);
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormError(null);
    setEditingId(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError("Invalid category name");
      return;
    }
    try {
      if (editingId != null) {
        await CategoriesAPI.update(editingId, name);
      } else {
        await CategoriesAPI.create(name);
      }
      closeModal();
      load();
      window.dispatchEvent(new Event('categories-changed'));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteCategory = async (id: number | string) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await CategoriesAPI.delete(id);
      load();
      window.dispatchEvent(new Event('categories-changed'));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Categories</h1>

      {loading && <p className="loading">Loading…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      <button className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={() => openModal()}>
        Add Category
      </button>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{editingId ? "Edit Category" : "Add Category"}</h3>
            <form onSubmit={submit}>
              <div className="input-group">
                <label>Name *</label>
                <input
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={String(c.id)}>
                  <td>{c.name}</td>
                  <td>
                    <button className="btn btn-ghost" onClick={() => openModal(c)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => deleteCategory(c.id)}>
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
