import { useNavigate } from "react-router-dom";

export default function Home({ token }) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minHeight: "70vh",
        padding: "2rem 1rem",
      }}
    >
      <h2 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
        Welcome to Gratuity Jar
      </h2>
      <p
        style={{ fontSize: "1.25rem", marginBottom: "2rem", maxWidth: "500px" }}
      >
        Capture your gratitude, reflect on your day, and cultivate positivity.
      </p>

      {/* Conditional buttons */}
      {token ? (
        <button
          onClick={() => navigate("/entries")}
          style={{
            backgroundColor: "var(--accent-color)",
            color: "var(--bg-color)",
            border: "none",
            borderRadius: "8px",
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            cursor: "pointer",
            marginBottom: "1rem",
          }}
        >
          View My Entries
        </button>
      ) : (
        <>
          <button
            onClick={() => navigate("/register")}
            style={{
              backgroundColor: "var(--accent-color)",
              color: "var(--bg-color)",
              border: "none",
              borderRadius: "8px",
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              cursor: "pointer",
              marginBottom: "1rem",
            }}
          >
            Get Started
          </button>
          <button
            onClick={() => navigate("/login")}
            style={{
              backgroundColor: "transparent",
              color: "var(--accent-color)",
              border: `2px solid var(--accent-color)`,
              borderRadius: "8px",
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Login
          </button>
        </>
      )}

      {/* Help Me Out button */}
      <button
        onClick={() => navigate("/entries")} // or fetch a random question
        style={{
          marginTop: "2rem",
          backgroundColor: "var(--accent-color)",
          color: "var(--bg-color)",
          border: "none",
          borderRadius: "8px",
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        Help Me Out
      </button>
    </div>
  );
}
