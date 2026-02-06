import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinCircle } from "../../api";

export default function JoinCircleLanding({ token }) {
  const { key } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!key) return;
    localStorage.setItem("pending_circle_key", key);

    async function attemptJoin() {
      if (!token) return;
      setStatus("joining");
      setError("");

      try {
        const circle = await joinCircle(token, key);
        localStorage.removeItem("pending_circle_key");
        localStorage.setItem("show_explore_prompt", "true");
        navigate(`/circles/${circle.id}`);
      } catch (err) {
        localStorage.removeItem("pending_circle_key");
        setError(err.message || "Failed to join circle");
        setStatus("error");
      }
    }

    attemptJoin();
  }, [key, token, navigate]);

  return (
    <div className="circles-content show">
      <h1 className="circles-title">You&apos;re invited</h1>
      <p className="circles-description">
        Join this Circle to share gratitude with people you trust.
      </p>

      {status === "joining" && <p className="circles-hint">Joining...</p>}
      {error && <p className="circles-hint">{error}</p>}

      {!token && (
        <div
          style={{
            display: "flex",
            gap: "1rem",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "1rem",
          }}
        >
          <button className="btn btn-primary" onClick={() => navigate("/login")}>
            Sign in to Join
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate("/register")}
          >
            Create an Account
          </button>
        </div>
      )}
    </div>
  );
}
