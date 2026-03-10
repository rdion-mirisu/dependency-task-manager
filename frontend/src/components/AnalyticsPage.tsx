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
import { getAverageWait, getAverageWaitByContact, getAverageWaitByUser, exportAnalyticsCsv } from "../api/tasks";

type AnalyticsRow = {
  contact_name: string;
  average_wait_hours: number;
  total_tasks: number;
};

export function AnalyticsPage() {
  const [contactData, setContactData] = React.useState<AnalyticsRow[]>([]);
  const [userData, setUserData] = React.useState<{
    username: string;
    average_wait_hours: number;
    total_tasks: number;
  }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    setLoading(true);

    Promise.all([getAverageWaitByContact(), getAverageWaitByUser()])
      .then(([contactArr, userArr]) => {
        if (Array.isArray(contactArr)) {
          const sorted = [...contactArr].sort(
            (a, b) => (b.average_wait_hours || 0) - (a.average_wait_hours || 0)
          );
          setContactData(sorted);
        } else {
          setError("Unexpected response from server for contact analytics");
        }
        if (Array.isArray(userArr)) {
          const sortedUsers = [...userArr].sort(
            (a, b) => (b.average_wait_hours || 0) - (a.average_wait_hours || 0)
          );
          setUserData(sortedUsers);
        } else {
          setError("Unexpected response from server for user analytics");
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>By Contact</h2>
            <button className="btn" onClick={async () => {
                try {
                  const res = await exportAnalyticsCsv();
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'tasks.csv';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                } catch (e) {
                  alert('Failed to export CSV');
                }
              }}>
              Export CSV
            </button>
          </div>

          <div className="card card-body" style={{ marginBottom: "1.5rem" }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={contactData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
                {contactData.map((d) => (
                  <tr key={d.contact_name}>
                    <td>{d.contact_name}</td>
                    <td>{d.average_wait_hours != null ? d.average_wait_hours.toFixed(2) : "—"}</td>
                    <td>{d.total_tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {contactData.length === 0 && (
            <div className="empty-state">No completed waiting tasks yet. Complete some tasks that were in “Waiting” to see analytics.</div>
          )}

          {/* second section: by user */}
          <h2 style={{ marginTop: '2rem' }}>By User</h2>
          <div className="card card-body" style={{ marginBottom: "1.5rem" }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={userData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="username" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
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
                  <th>User</th>
                  <th>Avg wait (hrs)</th>
                  <th>Total tasks</th>
                </tr>
              </thead>
              <tbody>
                {userData.map((d) => (
                  <tr key={d.username}>
                    <td>{d.username}</td>
                    <td>{d.average_wait_hours != null ? d.average_wait_hours.toFixed(2) : "—"}</td>
                    <td>{d.total_tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {userData.length === 0 && (
            <div className="empty-state">No completed waiting tasks yet. Complete some tasks that were in “Waiting” to see analytics.</div>
          )}
        </>
      )}
    </div>
  );
}
