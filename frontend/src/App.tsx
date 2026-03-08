import React from "react";
import {
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Dashboard } from "./components/Dashboard";
import { AnalyticsPage } from "./components/AnalyticsPage";
import { AdminPanel } from "./components/AdminPanel";
import { CalendarPage } from "./components/CalendarPage";
import {
  login,
  registerUser,
  setAuthToken,
  IntegrationAPI,
  getIsAdmin,
} from "./api/tasks";

function App() {
  const [mode, setMode] = React.useState("login");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [token, setToken] = React.useState(localStorage.getItem("token"));
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (token) {
      setAuthToken(token);
      localStorage.setItem("token", token);
      try {
        setIsAdmin(getIsAdmin());
      } catch {
        // ignore
      }
    }
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (code) {
      IntegrationAPI.finalizeGoogle(code).catch((e) => {
        console.error("OAuth finalize failed", e);
      });
      navigate(location.pathname, { replace: true });
    }
  }, [token, location, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const t = await login(email, password);
      setToken(t);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const u = username.trim();
    const em = email.trim();
    if (!u || !em) {
      setError("Username and email are required.");
      return;
    }
    setLoading(true);
    try {
      await registerUser(u, em, password);
      setSuccess("Account created. You can now sign in.");
      setMode("login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setToken(null);
    setAuthToken(null);
    localStorage.removeItem("token");
    navigate("/login");
  }

  const isLogin = mode === "login";

  const loginFormEl = (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1 className="auth-title">{isLogin ? "Sign in" : "Create account"}</h1>
        <div className="auth-switch">
          {isLogin ? (
            <>No account yet? <button type="button" onClick={() => { setMode("register"); setError(null); setSuccess(null); }}>Register</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => { setMode("login"); setError(null); setSuccess(null); }}>Sign in</button></>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={isLogin ? handleLogin : handleRegister}>
          {!isLogin && (
            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                placeholder="Your name"
              />
            </div>
          )}
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="you@example.com"
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginTop: "0.25rem" }}>
            {loading ? (isLogin ? "Signing in…" : "Creating account…") : isLogin ? "Sign in" : "Register"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      {token && (
        <nav className="app-nav">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/analytics">Analytics</Link>
          <Link to="/calendar">Calendar</Link>
          {isAdmin && <Link to="/admin">Admin</Link>}
          <button type="button" className="nav-logout" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      )}

      <Routes>
        <Route path="/login" element={token ? <Navigate to="/dashboard" /> : loginFormEl} />
        <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/analytics" element={token ? <AnalyticsPage /> : <Navigate to="/login" />} />
        <Route path="/calendar" element={token ? <CalendarPage /> : <Navigate to="/login" />} />
        <Route
          path="/admin"
          element={
            token ? (
              isAdmin ? <AdminPanel /> : <Navigate to="/dashboard" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} />} />
      </Routes>
    </div>
  );
}

export default App;
