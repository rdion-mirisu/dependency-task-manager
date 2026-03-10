import React from "react";
import { TasksAPI, exportICal } from "../api/tasks";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';

export function CalendarPage() {
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [tasks, setTasks] = React.useState<any[]>([]);

  const loadTasks = React.useCallback(async () => {
    try {
      const data = await TasksAPI.list();
      setTasks(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    }
  }, []);

  React.useEffect(() => {
    loadTasks();
    const handler = () => loadTasks();
    window.addEventListener('tasks-changed', handler);
    return () => window.removeEventListener('tasks-changed', handler);
  }, [loadTasks]);

  // build a list of events for FullCalendar; ensure all fields are
  // primitive values (strings) so React never tries to render a Date or
  // object as a child.  use the `start` property which is what the
  // dayGrid plugin expects for event placement.
  const events = React.useMemo(() => {
    return tasks
      .filter((t) => t.deadline)
      .map((t) => ({
        title: String(t.title),
        start: String(t.deadline),
      }));
  }, [tasks]);


  const handleExport = async () => {
    setError(null);
    setExporting(true);
    try {
      const blob = await exportICal();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tasks.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Calendar</h1>

      <div className="card card-body" style={{ marginBottom: "1.5rem" }}>
        <p style={{ margin: "0 0 1rem", color: "var(--text-muted)" }}>
          View your task deadlines on the calendar or export them as an iCal file.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export iCal"}
          </button>
        </div>
      </div>

      <div className="card card-body">
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={events}
        />
      </div>
    </div>
  );
}
