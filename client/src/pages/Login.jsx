import { useState } from "react";
import { Link } from "react-router-dom";
import { loginUser, registerUser } from "../api";

export default function AuthForm({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const result = isLogin
        ? await loginUser({ email, password })
        : await registerUser({
            name,
            email,
            password,
            password_confirm: passwordConfirm,
          });

      if (isLogin) {
        onLogin(result.token);
        return;
      }

      setError("");
      setLoading(false);
      setIsLogin(true);
      setPassword("");
      setPasswordConfirm("");
      setName("");
      alert(result.message || "Please verify your email, then log in.");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="entry-card entries-container">
      <h1>{isLogin ? "Welcome back!" : "Create an account"}</h1>

      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}

        <input
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          placeholder="Password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {!isLogin && (
          <input
            placeholder="Confirm Password"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
          />
        )}

        <button className="btn btn-secondary" type="submit" disabled={loading}>
          {loading
            ? isLogin
              ? "Logging in..."
              : "Creating account..."
            : isLogin
            ? "Login"
            : "Register"}
        </button>
      </form>
      {isLogin && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      )}

      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        {isLogin ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="icon-btn"
          onClick={() => setIsLogin((prev) => !prev)}
        >
          {isLogin ? "Register" : "Login instead"}
        </button>
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
