import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";

import Header from "./components/Header";
import Home from "./pages/Home";
import GratitudeEntries from "./pages/GratitudeEntries";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import RemindersPage from "./pages/Reminders";
import Circles from "./pages/circles/Circles";
import CircleDetail from "./pages/circles/CircleDetail";
import ProtectedRoute from "./components/ProtectedRoute";
import CirclesLayout from "./pages/circles/CirclesLayout";
import JoinCircleLanding from "./pages/circles/JoinCircleLanding";
import { joinCircle } from "./api";

function AppRoutes({ token, setToken, theme, setTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = Boolean(token);

  async function handleLogin(newToken) {
    setToken(newToken);
    localStorage.setItem("token", newToken);
    const pendingKey = localStorage.getItem("pending_circle_key");

    if (pendingKey) {
      try {
        const circle = await joinCircle(newToken, pendingKey);
        localStorage.removeItem("pending_circle_key");
        localStorage.setItem("show_explore_prompt", "true");
        navigate(`/circles/${circle.id}`);
        return;
      } catch (err) {
        localStorage.removeItem("pending_circle_key");
        navigate("/circles");
        return;
      }
    }

    navigate("/entries");
  }

  function handleLogout() {
    setToken("");
    localStorage.removeItem("token");
    navigate("/");
  }

  useEffect(() => {
    const joinKey = new URLSearchParams(location.search).get("join");
    if (joinKey && location.pathname === "/") {
      navigate(`/circles/join/${joinKey}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  // get current path to conditionally render Header
  const currentPath = location.pathname;
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

      <Routes location={location} key={`${location.pathname}${location.search}`}>
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
            isAuthenticated ? (
              <RemindersPage />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />

        <Route
          path="/circles"
          element={
            <ProtectedRoute token={token}>
              <CirclesLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Circles token={token} />} />
          <Route path=":id" element={<CircleDetail token={token} />} />
        </Route>

        <Route path="/circles/join/:key" element={<CirclesLayout />}>
          <Route index element={<JoinCircleLanding token={token} />} />
        </Route>

        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/circles/:id"
          element={
            <ProtectedRoute token={token}>
              <CircleDetail token={token} />
            </ProtectedRoute>
          }
        />
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
