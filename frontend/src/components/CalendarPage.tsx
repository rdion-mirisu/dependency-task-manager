import React from "react";
import { IntegrationAPI } from "../api/tasks";

export function CalendarPage() {
  const [connecting, setConnecting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const { auth_url } = await IntegrationAPI.connectGoogle();
      window.location.href = auth_url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to connect");
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setError(null);
    setSyncing(true);
    try {
      await IntegrationAPI.syncGoogle();
      setSyncing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    setError(null);
    setExporting(true);
    try {
      const blob = await IntegrationAPI.exportICal();
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
          Connect Google Calendar to sync tasks with deadlines, or export your tasks as an iCal file.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Redirecting…" : "Connect Google Calendar"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync to Google Calendar"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export iCal"}
          </button>
        </div>
      </div>
    </div>
  );
}
