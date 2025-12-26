import { Link, useLocation } from "react-router-dom";

export default function Header({ token, onLogout, theme, setTheme }) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isAuthenticated = Boolean(token);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
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
      {/* Left */}
      {!isHome && (
        <Link to="/" style={{ fontWeight: 700, textDecoration: "none" }}>
          Gratuity Jar
        </Link>
      )}

      {/* Right */}
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
