import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinCircle, registerUser } from "../api";

export default function Register({ onLogin }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    try {
      const result = await registerUser({ name, email, password });

      if (onLogin) {
        onLogin(result.token);
        return;
      }

      localStorage.setItem("token", result.token);

      const pendingKey = localStorage.getItem("pending_circle_key");
      if (pendingKey) {
        try {
          const circle = await joinCircle(result.token, pendingKey);
          localStorage.removeItem("pending_circle_key");
          localStorage.setItem("show_explore_prompt", "true");
          navigate(`/circles/${circle.id}`);
          return;
        } catch (err) {
          localStorage.removeItem("pending_circle_key");
          navigate("/circles");
          return;
        }
      }

      navigate("/entries");
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
        <button className="btn btn-secondary" type="submit">Register</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
