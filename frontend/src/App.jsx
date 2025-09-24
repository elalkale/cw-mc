import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import LoginForm from "./components/LoginForm.jsx";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Navbar from "./components/Navbar.jsx";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [servers, setServers] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const [activeServer, setActiveServer] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // 👈 modal logout

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
    await fetch("http://localhost:4000/logout", {
      method: "POST",
      credentials: "include",
    });
    setLoggedIn(false);
    setShowLogoutConfirm(false);
  };

  if (!loggedIn) return <LoginForm onLogin={() => setLoggedIn(true)} />;

  return (
    <Router>
      <div className={darkMode ? "dark" : ""}>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 relative transition-colors">
          <Navbar
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            onLogout={() => setShowLogoutConfirm(true)} // 👈 dispara modal
          />
          <div className="pt-12">
          <Routes>
            <Route index element={<Home />} />
            <Route
              path="dashboard"
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

          {/* Modal de confirmación */}
          {showLogoutConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-80">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  ¿Seguro que quieres cerrar sesión?
                </h3>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={logout}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Router>
  );
}
