import { useState } from "react";
import { forgotPassword } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await forgotPassword(email);
      setMessage(
        result.message ||
          "If an account exists, a reset link has been sent to that email."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="entry-card entries-container">
      <h1>Forgot Password</h1>
      <p style={{ color: "var(--muted-text)" }}>
        Enter your email and we will send a password reset link.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="btn btn-secondary" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
