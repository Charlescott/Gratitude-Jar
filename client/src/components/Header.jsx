import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "../assets/logo.png"; // put your logo in src/assets

export default function Header({ token, onLogout }) {
  const [theme, setTheme] = useState("light");
  const navigate = useNavigate();

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleLogout = () => {
    onLogout();
    navigate("/"); // send user home
  };

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        backgroundColor: "var(--bg-color)",
      }}
    >
      {/* Logo / Title */}
      <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
        <img src={logo} alt="Gratuity Jar Logo" style={{ height: "40px", marginRight: "0.5rem" }} />
        <h1 style={{ margin: 0, color: "var(--text-color)" }}>Gratuity Jar</h1>
      </Link>

      {/* Right-side nav */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            fontSize: "1.25rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-color)",
          }}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>

        <nav style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link to="/" style={{ textDecoration: "none", fontWeight: "bold", color: "var(--text-color)" }}>
            Home
          </Link>
          {token && (
            <Link to="/entries" style={{ textDecoration: "none", fontWeight: "bold", color: "var(--text-color)" }}>
              Entries
            </Link>
          )}
          {token ? (
            <button onClick={handleLogout} style={{ fontWeight: "bold", cursor: "pointer" }}>
              Logout
            </button>
          ) : (
            <>
              <Link to="/login" style={{ fontWeight: "bold", color: "var(--text-color)" }}>Login</Link>
              <Link to="/register" style={{ fontWeight: "bold", color: "var(--text-color)" }}>Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
