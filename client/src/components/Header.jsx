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
        padding: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {/* Left */}
      {!isHome && (
        <Link to="/">
          <img src={logo} alt="Gratuity Jar logo" style={{ height: "90px" }} />
        </Link>
      )}

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: "6rem" }}>
        {!isHome &&
          (isAuthenticated ? (
            <button className="btn btn-secondary" onClick={onLogout}>
              Logout
            </button>
          ) : (
            <>
              <Link className="btn btn-secondary" to="/login">
                Login
              </Link>
              <Link className="btn btn-secondary" to="/register">
                Register
              </Link>
            </>
          ))}

        <button onClick={toggleTheme} className="icon-btn">
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
    </header>
  );
}
