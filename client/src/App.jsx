import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";

import Header from "./components/Header";
import Home from "./pages/Home";
import GratitudeEntries from "./pages/GratitudeEntries";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RemindersPage from "./pages/Reminders";

function AppRoutes({ token, setToken, theme, setTheme }) {
  const navigate = useNavigate();
  const isAuthenticated = Boolean(token);

  function handleLogin(newToken) {
    setToken(newToken);
    localStorage.setItem("token", newToken);
    navigate("/entries");
  }

  function handleLogout() {
    setToken("");
    localStorage.removeItem("token");
    navigate("/");
  }

  // get current path to conditionally render Header
  const currentPath = window.location.pathname;
  const showHeader = currentPath !== "/";

  return (
    <>
      {showHeader && (
        <Header
          token={token}
          onLogout={handleLogout}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      <Routes>
        <Route
          path="/"
          element={
            <Home
              isAuthenticated={isAuthenticated}
              theme={theme}
              setTheme={setTheme} // pass theme toggle to Home
            />
          }
        />
        <Route
          path="/entries"
          element={
            isAuthenticated ? (
              <GratitudeEntries token={token} />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/reminders"
          element={
            isAuthenticated ? <RemindersPage /> : <Login onLogin={handleLogin} />
          }
        />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </>
  );
}


export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Router>
      <AppRoutes
        token={token}
        setToken={setToken}
        theme={theme}
        setTheme={setTheme}
      />
    </Router>
  );
}
