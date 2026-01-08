import { Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import logo from "../assets/logo.png";

export default function Header({ token, onLogout, theme, setTheme }) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isAuthenticated = Boolean(token);

  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Close dropdown if clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <img src={logo} alt="Gratuity Jar logo" style={{ height: "80px" }} />
        </Link>
      ) : (
        <div /> // spacer
      )}

      {/* Right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          position: "relative",
        }}
      >
        {isAuthenticated && (
          <div
            className="profile-menu"
            ref={dropdownRef}
            style={{ position: "relative" }}
          >
            <button
              className="btn btn-secondary"
              onClick={() => setProfileOpen((prev) => !prev)}
            >
              Profile
            </button>

            <div
              className="dropdown"
              style={{
                position: "absolute",
                right: 0,
                marginTop: "0.5rem",
                background: "var(--card-bg)",
                borderRadius: "12px",
                padding: "0.5rem 0",
                boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                display: "flex",
                flexDirection: "column",
                minWidth: "150px",
                zIndex: 10,
                opacity: profileOpen ? 1 : 0,
                transform: profileOpen ? "translateY(0)" : "translateY(-15px)",
                pointerEvents: profileOpen ? "auto" : "none",
                transition:
                  "opacity 0.35s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)",
              }}
            >
              <Link
                to="/entries"
                className="dropdown-item"
                onClick={() => setProfileOpen(false)}
                style={{ padding: "0.5rem 1rem" }}
              >
                Entries
              </Link>
              <Link
                to="/reminders"
                className="dropdown-item"
                onClick={() => setProfileOpen(false)}
                style={{ padding: "0.5rem 1rem" }}
              >
                Reminders
              </Link>
              <Link
                to="/settings"
                className="dropdown-item"
                onClick={() => setProfileOpen(false)}
                style={{ padding: "0.5rem 1rem" }}
              >
                Circles
              </Link>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="dropdown-item"
                style={{
                  padding: "0.5rem 1rem",
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-color)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Theme toggle */}
        <button onClick={toggleTheme} className="icon-btn">
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
    </header>
  );
}
