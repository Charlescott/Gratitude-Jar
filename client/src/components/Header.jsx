import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

export default function Header({ token, onLogout }) {
  const [theme, setTheme] = useState("light");
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === "/";

  const isAuthenticated = Boolean(token);

  

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <header
      style={{
        padding: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {/* Left side */}
      {!isHome && (
        <Link to="/" style={{ fontWeight: 700, textDecoration: "none" }}>
          Gratuity Jar
        </Link>
      )}

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button onClick={toggleTheme} className="icon-btn">
          {theme === "light" ? "🌙" : "☀️"}
        </button>

        {!isHome &&
          (isAuthenticated ? (
            <button onClick={onLogout}>Logout</button>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          ))}
      </div>
    </header>
  );
}
