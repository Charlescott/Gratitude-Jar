import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
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
import Friends from "./pages/Friends";
import Feed from "./pages/Feed";
import Circles from "./pages/circles/Circles";
import CircleDetail from "./pages/circles/CircleDetail";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import CirclesLayout from "./pages/circles/CirclesLayout";
import JoinCircleLanding from "./pages/circles/JoinCircleLanding";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCircles from "./pages/admin/AdminCircles";
import { fetchMe, joinCircle } from "./api";

function AppRoutes({ token, setToken, user, setUser, theme, setTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = Boolean(token);
  const [authChecked, setAuthChecked] = useState(!token);

  useEffect(() => {
    let canceled = false;
    async function verifySession() {
      if (!token) {
        setAuthChecked(true);
        return;
      }
      try {
        const me = await fetchMe(token);
        if (canceled) return;
        setUser(me);
        localStorage.setItem("user", JSON.stringify(me));
      } catch {
        if (canceled) return;
        setToken("");
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        const protectedPaths = ["/entries", "/reminders", "/circles", "/friends", "/feed", "/admin"];
        if (protectedPaths.some((p) => location.pathname.startsWith(p))) {
          navigate("/", { replace: true });
        }
      } finally {
        if (!canceled) setAuthChecked(true);
      }
    }
    verifySession();
    return () => {
      canceled = true;
    };
    // Run only on initial mount; login/logout flows manage state directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(newToken, newUser) {
    setToken(newToken);
    localStorage.setItem("token", newToken);
    if (newUser) {
      setUser(newUser);
      localStorage.setItem("user", JSON.stringify(newUser));
    } else {
      try {
        const me = await fetchMe(newToken);
        setUser(me);
        localStorage.setItem("user", JSON.stringify(me));
      } catch {
        // If this fails, server will still enforce admin-only routes.
      }
    }
    const pendingKey = localStorage.getItem("pending_circle_key");

    if (pendingKey) {
      try {
        const circle = await joinCircle(newToken, pendingKey);
        localStorage.removeItem("pending_circle_key");
        localStorage.setItem("show_explore_prompt", "true");
        navigate(`/circles/${circle.id}`);
        return;
      } catch {
        localStorage.removeItem("pending_circle_key");
        navigate("/circles");
        return;
      }
    }

    navigate("/feed");
  }

  function handleLogout() {
    setToken("");
    localStorage.removeItem("token");
    setUser(null);
    localStorage.removeItem("user");
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

  if (!authChecked) {
    return null;
  }

  return (
    <>
      {showHeader && (
        <Header
          token={token}
          user={user}
          onLogout={handleLogout}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      <Routes location={location} key={`${location.pathname}${location.search}`}>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/feed" replace />
            ) : (
              <Home
                isAuthenticated={isAuthenticated}
                theme={theme}
                setTheme={setTheme} // pass theme toggle to Home
              />
            )
          }
        />
        <Route
          path="/feed"
          element={
            isAuthenticated ? (
              <Feed token={token} />
            ) : (
              <Login onLogin={handleLogin} />
            )
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
          path="/friends"
          element={
            isAuthenticated ? <Friends /> : <Login onLogin={handleLogin} />
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
          path="/admin"
          element={
            <AdminRoute token={token} user={user}>
              <AdminDashboard token={token} />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute token={token} user={user}>
              <AdminUsers token={token} />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/circles"
          element={
            <AdminRoute token={token} user={user}>
              <AdminCircles token={token} />
            </AdminRoute>
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
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
        user={user}
        setUser={setUser}
        theme={theme}
        setTheme={setTheme}
      />
    </Router>
  );
}
