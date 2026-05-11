import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../services/api";

function roleHome(role) {
  if (role === "admin") return "/admin";
  if (role === "Project Manager") return "/pm";
  if (role === "Team Leader") return "/tl";
  if (role === "Senior Developer") return "/sd";
  return "/jd";
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    const raw = sessionStorage.getItem("user");
    if (raw) {
      try {
        const u = JSON.parse(raw);
        if (u && u.role) {
          window.location.href = roleHome(u.role);
        }
      } catch(e) {}
    }
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error("Enter username and password");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login(username, password);
      login(res.data);
      window.location.href = roleHome(res.data.role);
      toast.success("Welcome back");
    } catch {
      toast.error("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-pro-page">
      <div className="login-pro-bg-glow login-glow-1" />
      <div className="login-pro-bg-glow login-glow-2" />

      <div className="login-pro-card">
        <div className="login-pro-brand">
          <div className="login-pro-logo">AI</div>
          <div>
            <h1>Enterprise AI Knowledge Assistant</h1>
            <p>Secure sign-in for all roles</p>
          </div>
        </div>

        <div className="login-pro-header">
          <h2>Welcome Back</h2>
          <p>Sign in to access your workspace</p>
        </div>

        <form className="login-pro-form" onSubmit={onSubmit}>
          <div className="field-group">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>

          <div className="field-group">
            <label>Password</label>
            <div className="password-wrap-pro">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type={showPassword ? "text" : "password"}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button className="primary-btn login-submit-btn" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}