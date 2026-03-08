import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { getAverageWait } from "../api/tasks";

type AnalyticsRow = {
  contact_name: string;
  average_wait_hours: number;
  total_tasks: number;
};

export function AnalyticsPage() {
  const [data, setData] = React.useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    setLoading(true);
    getAverageWait()
      .then((arr) => {
        if (Array.isArray(arr)) {
          const sorted = [...arr].sort(
            (a, b) => (b.average_wait_hours || 0) - (a.average_wait_hours || 0)
          );
          setData(sorted);
        } else {
          setError("Unexpected response from server");
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">Average Wait Analytics</h1>

      {loading && <p className="loading">Loading analytics…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="card card-body" style={{ marginBottom: "1.5rem" }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="contact_name" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
                  labelStyle={{ color: "var(--text)" }}
                />
                <Bar dataKey="average_wait_hours" name="Avg wait (hrs)" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Avg wait (hrs)</th>
                  <th>Total tasks</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.contact_name}>
                    <td>{d.contact_name}</td>
                    <td>{d.average_wait_hours != null ? d.average_wait_hours.toFixed(2) : "—"}</td>
                    <td>{d.total_tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length === 0 && (
            <div className="empty-state">No completed waiting tasks yet. Complete some tasks that were in “Waiting” to see analytics.</div>
          )}
        </>
      )}
    </div>
  );
}
