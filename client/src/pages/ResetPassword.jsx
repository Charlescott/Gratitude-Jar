import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resetPassword } from "../api";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search]
  );

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setMessage("");

    if (!token) {
      setError("Missing or invalid reset token.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword({ token, password });
      setMessage(result.message || "Password updated successfully.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="entry-card entries-container">
      <h1>Reset Password</h1>
      {!token ? (
        <p style={{ color: "red" }}>
          Invalid reset link. <Link to="/forgot-password">Request a new one</Link>.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            placeholder="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            placeholder="Confirm New Password"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
          />
          <button className="btn btn-secondary" type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      )}
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
