import React from "react";
import { useForm } from "react-hook-form";
import { TasksAPI, CreateTaskPayload, Task } from "../api/tasks";

type FormData = {
  title: string;
  category: string;
  urgency: string;
  description: string;
  deadline?: string;
};

export function CreateTaskForm({ onCreated }: { onCreated: (task: Task) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    defaultValues: { title: "", category: "", urgency: "", description: "", deadline: "" },
  });

  const [apiError, setApiError] = React.useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      const payload: CreateTaskPayload = {
        title: data.title.trim(),
        category: data.category.trim(),
        urgency: data.urgency.trim(),
        description: data.description.trim(),
        status: "active",
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      };
      const created = await TasksAPI.create(payload);
      onCreated(created);
      reset();
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
        <input
          type="text"
          className="input"
          {...register("category", { required: "Category is required" })}
          disabled={isSubmitting}
          placeholder="e.g. work, personal"
        />
        {errors.category && <div className="alert alert-error">{errors.category.message}</div>}
      </div>

      <div className="input-group">
        <label>Urgency *</label>
        <input
          type="text"
          className="input"
          {...register("urgency", { required: "Urgency is required" })}
          disabled={isSubmitting}
          placeholder="low, medium, high"
        />
        {errors.urgency && <div className="alert alert-error">{errors.urgency.message}</div>}
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
          {...register("deadline")}
          disabled={isSubmitting}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Creating…" : "Create Task"}
      </button>
    </form>
  );
}
