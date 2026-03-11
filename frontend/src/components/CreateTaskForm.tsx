import React from "react";
import { useForm } from "react-hook-form";
import { TasksAPI, CategoriesAPI, CreateTaskPayload, Task, Category } from "../api/tasks";

type FormData = {
  title: string;
  category_id: string;
  // urgency removed; priority will be used instead
  description: string;
  deadline?: string;
  priority?: "High" | "Medium" | "Low";
  color_code?: string;
};

export function CreateTaskForm({ onCreated }: { onCreated: (task: Task) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      title: "",
      category_id: "",
      description: "",
      deadline: "",
      priority: "Low",
      color_code: "#808080",
    },
  });

  const [toast, setToast] = React.useState<string | null>(null);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);

  React.useEffect(() => {
    const loadCats = async () => {
      try {
        const list = await CategoriesAPI.list();
        setCategories(list);
      } catch {
        setCategories([]);
      }
    };
    loadCats();
    // when categories are modified elsewhere we should refresh our local copy
    const handler = () => loadCats();
    window.addEventListener('categories-changed', handler);
    return () => window.removeEventListener('categories-changed', handler);
  }, []);

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      const payload: CreateTaskPayload = {
        title: data.title.trim(),
        // ensure urgency always reflects priority, no user input
        urgency: (data.priority ?? "Low").trim(),
        description: data.description.trim(),
        status: "active",
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        priority: data.priority ?? "Low",
        color_code: data.color_code ?? "#808080",
      };
      if (data.category_id) {
        payload.category_id = Number(data.category_id);
      }
      const created = await TasksAPI.create(payload);
      onCreated(created);
      reset();
      if ((created as any).warnings && (created as any).warnings.length) {
        setToast((created as any).warnings.join(', '));
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to create task");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700 }}>
        Create New Task
      </h2>
      {apiError && <div className="alert alert-error">{apiError}</div>}
      {categories.length === 0 && (
        <div className="alert alert-error">
          No categories yet – please add one before creating tasks.
        </div>
      )}

      <div className="input-group">
        <label>Title *</label>
        <input
          type="text"
          className="input"
          {...register("title", { required: "Title is required" })}
          disabled={isSubmitting}
          placeholder="What needs to be done?"
        />
        {errors.title && <div className="alert alert-error">{errors.title.message}</div>}
      </div>

      <div className="input-group">
        <label>Category *</label>
        <select
          className="input"
          {...register("category_id", { required: "Category is required" })}
          disabled={isSubmitting}
        >
          <option value="">-- select --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {errors.category_id && <div className="alert alert-error">{errors.category_id.message}</div>}
      </div>


      <div className="input-group">
        <label>Description *</label>
        <textarea
          className="input"
          {...register("description", { required: "Description is required" })}
          disabled={isSubmitting}
          placeholder="Add more details…"
          rows={3}
        />
        {errors.description && <div className="alert alert-error">{errors.description.message}</div>}
      </div>

      <div className="input-group">
        <label>Deadline (optional)</label>
        <input
          type="datetime-local"
          className="input"
          {...register("deadline", {
            validate: value => {
              if (value && new Date(value) < new Date()) {
                return "Deadline must be a future date";
              }
              return true;
            }
          })}
          disabled={isSubmitting}
        />
        {errors.deadline && <div className="alert alert-error">{errors.deadline.message}</div>}
      </div>

      <div className="input-group">
        <label>Priority</label>
        <select
          className="input"
          {...register("priority")}
          disabled={isSubmitting}
        >
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      <div className="input-group">
        <label>Color</label>
        {/* simple palette instead of native color picker */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {['#e74c3c', '#f1c40f', '#7f8c8d', '#3498db', '#2ecc71', '#808080'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue('color_code', c)}
              disabled={isSubmitting}
              style={{
                backgroundColor: c,
                width: '24px',
                height: '24px',
                border: watch('color_code') === c ? '2px solid #000' : '1px solid #ccc',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={isSubmitting || categories.length === 0}>
        {isSubmitting ? "Creating…" : "Create Task"}
      </button>
      {toast && <div className="toast toast-success" style={{ marginTop: '1rem' }}>{toast}</div>}
    </form>
  );
}