import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Home({ isAuthenticated }) {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200);

    if (isAuthenticated) {
      navigate("/entries");
    }
    return () => clearTimeout(t);
  }, [isAuthenticated, navigate]);

  return (
    <div className="home">
      <img
        src={logo}
        alt="Gratuity Jar logo"
        className={`home-logo ${visible ? "show" : ""}`}
      />

      <p className="tagline">A simple place to pause and notice what’s good.</p>

      <button
        className="primary"
        onClick={() => navigate(isAuthenticated ? "/entries" : "/login")}
      >
        {isAuthenticated ? "Go to my entries" : "Start journaling"}
      </button>
    </div>
  );
}
