import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../api";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (password !== passwordConfirm) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      const result = await registerUser({
        name,
        email,
        password,
        password_confirm: passwordConfirm,
      });
      setMessage(
        result.message ||
          "Account created. Please verify your email before logging in."
      );
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="entry-card entries-container">
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          placeholder="Confirm Password"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
        />
        <button className="btn btn-secondary" type="submit">Register</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
