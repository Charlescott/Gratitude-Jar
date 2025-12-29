import { Link, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";

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
        padding: "1rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {/* Left */}
      {!isHome ? (
        <Link to="/">
          <img
            src={logo}
            alt="Gratuity Jar logo"
            style={{ height: "80px" }}
          />
        </Link>
      ) : (
        <div /> 
      )}

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        {isAuthenticated && (
          <button className="btn btn-secondary" onClick={onLogout}>
            Logout
          </button>
        )}

        <button onClick={toggleTheme} className="icon-btn">
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
    </header>
  );
}
