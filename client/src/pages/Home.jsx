import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Home({ isAuthenticated, theme, setTheme }) {
  const [showLogo, setShowLogo] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const logoTimer = setTimeout(() => setShowLogo(true), 200);
    const buttonTimer = setTimeout(() => setShowButton(true), 900);

    if (isAuthenticated) {
      navigate("/entries");
    }

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(buttonTimer);
    };
  }, [isAuthenticated, navigate]);

  return (
    <div className="home">
      {/* Theme toggle top-right */}
      <div className="home-theme-toggle">
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="icon-btn"
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>

      <img
        src={logo}
        alt="Gratuity Jar logo"
        className={`home-logo ${showLogo ? "show" : ""}`}
      />

      <h1 className="home-title">Gratitude Jar</h1>

      <p className="tagline">A simple place to pause and notice what’s good.</p>
      <button
        className={`btn btn-primary ${showButton ? "show" : ""}`}
        onClick={() => navigate("/entries")}
      >
        Start journaling
      </button>
    </div>
  );
}
