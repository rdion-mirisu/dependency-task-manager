import React from "react";
import { Dashboard } from "./components/Dashboard";
import { login, registerUser } from "./api/tasks";

function App() {
  const [mode, setMode] = React.useState("login"); // "login" | "register"
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [token, setToken] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [success, setSuccess] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const t = await login(email, password); // calls /api/auth/login and stores JWT
      setToken(t);
    } catch (err) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await registerUser(username, email, password);
      setSuccess("Account created. You can now sign in.");
      // Optionally switch back to login mode
      setMode("login");
    } catch (err) {
      setError(err.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  // If not logged in yet, show login/register form.
  if (!token) {
    return (
      <div
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f5",
        }}
      >
        <form
          onSubmit={isLogin ? handleLogin : handleRegister}
          style={{
            padding: 24,
            borderRadius: 12,
            background: "white",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            minWidth: 320,
          }}
        >
          <h1 style={{ marginBottom: 8, fontSize: 22 }}>
            {isLogin ? "Sign in" : "Create account"}
          </h1>
          <div style={{ fontSize: 13, marginBottom: 16 }}>
            {isLogin ? (
              <>
                No account yet?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                    setSuccess(null);
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#1976d2",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setSuccess(null);
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#1976d2",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>

          {error && (
            <div
              style={{
                color: "crimson",
                marginBottom: 12,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                color: "green",
                marginBottom: 12,
                fontSize: 14,
              }}
            >
              {success}
            </div>
          )}

          {!isLogin && (
            <div style={{ marginBottom: 12 }}>
              <label
                style={{ display: "block", fontSize: 14, fontWeight: 600 }}
              >
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label
              style={{ display: "block", fontSize: 14, fontWeight: 600 }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                borderRadius: 4,
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{ display: "block", fontSize: 14, fontWeight: 600 }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                borderRadius: 4,
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 4,
              border: "none",
              background: "#4CAF50",
              color: "white",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? isLogin
                ? "Signing in..."
                : "Creating account..."
              : isLogin
              ? "Sign in"
              : "Register"}
          </button>
        </form>
      </div>
    );
  }

  // Once logged in, the Dashboard can call /api/tasks
  // and the JWT will automatically be sent with each request.
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Dashboard />
    </div>
  );
}

export default App;
