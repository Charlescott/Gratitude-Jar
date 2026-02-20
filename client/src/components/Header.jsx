import { Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import logo from "../assets/logo.png";

export default function Header({ token, onLogout, theme, setTheme }) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isCircles = location.pathname.startsWith("/circles");
  const isAuthenticated = Boolean(token);

  const [profileOpen, setProfileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
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

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const headerPadding = isCircles
    ? isMobile
      ? "0.35rem 0.65rem"
      : "0.3rem 1rem"
    : isMobile
    ? "0.45rem 0.75rem"
    : "0.75rem 1rem";
  const logoHeight = isCircles
    ? isMobile
      ? "32px"
      : "56px"
    : isMobile
    ? "38px"
    : "80px";
  const profileButtonStyle = isMobile
    ? { minWidth: "auto", padding: "0.45rem 0.85rem", fontSize: "0.9rem" }
    : undefined;

  return (
    <header
      style={{
        padding: headerPadding,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        width: "100%",
        minHeight: isMobile ? "56px" : "72px",
        boxSizing: "border-box",
        zIndex: 100,
        background: isCircles ? "transparent" : "var(--bg-color)",
        backdropFilter: isCircles ? "none" : "blur(8px)",
      }}
    >
      {/* Left */}
      {!isHome ? (
        <Link to="/">
          <img
            src={logo}
            alt="Gratitude Jar logo"
            style={{
              height: logoHeight,
              width: "auto",
              display: "block",
            }}
          />
        </Link>
      ) : (
        <div /> // spacer
      )}

      {/* Right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? "0.5rem" : "1rem",
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
              style={profileButtonStyle}
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
                to="/circles"
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
        <button
          onClick={toggleTheme}
          className="icon-btn"
          style={isMobile ? { padding: "0.25rem 0.4rem", lineHeight: 1 } : undefined}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
    </header>
  );
}
