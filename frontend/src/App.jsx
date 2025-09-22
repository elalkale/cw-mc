import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import LoginForm from "./components/LoginForm.jsx";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [servers, setServers] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const [activeServer, setActiveServer] = useState(null);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/status", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      } else if (res.status === 401) {
        setLoggedIn(false);
      }
    } catch (err) {
      console.error("Error fetchStatus:", err);
    }
  };

  useEffect(() => {
    if (loggedIn) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [loggedIn]);

  const startServer = async (name) => {
    await fetch("http://localhost:4000/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    setTimeout(fetchStatus, 1000);
  };

  const stopServer = async (name) => {
    await fetch("http://localhost:4000/api/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    setTimeout(fetchStatus, 1000);
  };

  const logout = async () => {
    await fetch("http://localhost:4000/logout", { method: "POST", credentials: "include" });
    setLoggedIn(false);
  };

  if (!loggedIn) return <LoginForm onLogin={() => setLoggedIn(true)} />;

  return (
    <Router>
      <div className={darkMode ? "dark" : ""}>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6 relative transition-colors">
          <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} onLogout={logout} />

          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  servers={servers}
                  activeServer={activeServer}
                  setActiveServer={setActiveServer}
                  startServer={startServer}
                  stopServer={stopServer}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
