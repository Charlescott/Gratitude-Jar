import {
  BrowserRouter as Router,
} from "react-router-dom";
import { useState } from "react";
import Layout from "./Layout";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  function handleLogin(newToken) {
    setToken(newToken);
    localStorage.setItem("token", newToken);
  }

  function handleLogout() {
    setToken("");
    localStorage.removeItem("token");
  }

  return (
    <Router>
      <Layout
        token={token}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    </Router>
  );
}

export default App;
