import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { useEffect, useState } from "react";
import Header from "./components/Header";
import Home from "./pages/Home";
import GratitudeEntries from "./pages/GratitudeEntries";
import Login from "./pages/Login";
import Register from "./pages/Register";



function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
   const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const isAuthenticated = Boolean(token);

  function handleLogin(newToken) {
    setToken(newToken);
    localStorage.setItem("token", newToken);
  }

  function handleLogout() {
    setToken("");
    localStorage.removeItem("token");
  }

 

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  },
    [theme]);



  return (
    <Router>
      <Header
        token={token}
        onLogout={handleLogout}
        theme={theme}
        setTheme={setTheme}
      />

      <Routes>
        <Route path="/" element={<Home isAuthenticated={isAuthenticated} />} />
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
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}

export default App;
