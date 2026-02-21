// App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import LoginForm from "./components/LoginForm.jsx";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ServerDetailPage from "./pages/ServerDetailPage.jsx";
import Navbar from "./components/Navbar.jsx";

// Helper para hacer fetch con token JWT
async function fetchWithToken(url, options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, { ...options, headers });
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [servers, setServers] = useState({});
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true; // Por defecto dark mode
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loading, setLoading] = useState(true); // Estado de carga inicial

  // Guardar darkMode en localStorage cuando cambia
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const fetchStatus = async () => {
    try {
      const res = await fetchWithToken("http://localhost:4000/api/status");
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

  // Verificar sesión al cargar la app
  useEffect(() => {
    const verifySession = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetchWithToken("http://localhost:4000/api/me");
        if (res.ok) {
          const data = await res.json();
          if (data.loggedIn) {
            setLoggedIn(true);
          }
        } else {
          // Token inválido, limpiarlo
          localStorage.removeItem('authToken');
        }
      } catch (err) {
        console.error("Error verificando sesión:", err);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  useEffect(() => {
    if (loggedIn) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [loggedIn]);

  const startServer = async (name) => {
    await fetchWithToken("http://localhost:4000/api/start", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setTimeout(fetchStatus, 1000);
  };

  const stopServer = async (name) => {
    await fetchWithToken("http://localhost:4000/api/stop", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setTimeout(fetchStatus, 1000);
  };

  // 👇 NUEVO: enviar comandos al servidor
  const sendCommand = async (name, command) => {
    try {
      await fetchWithToken("http://localhost:4000/api/command", {
        method: "POST",
        body: JSON.stringify({ name, command }),
      });
    } catch (err) {
      console.error("Error sendCommand:", err);
    }
  };

  const logout = async () => {
    await fetchWithToken("http://localhost:4000/logout", {
      method: "POST",
    });
    localStorage.removeItem('authToken');
    setLoggedIn(false);
    setShowLogoutConfirm(false);
  };

  // Mostrar pantalla de carga si aún verificamos sesión
  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${darkMode ? "bg-gradient-to-br from-purple-900 via-gray-900 to-black" : "bg-gradient-to-br from-purple-100 via-white to-purple-50"}`}>
        <div className="text-center">
          <div className={`w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4 ${darkMode ? "border-purple-500 border-t-transparent" : "border-purple-400 border-t-transparent"}`}></div>
          <p className={`text-lg font-semibold ${darkMode ? "text-purple-300" : "text-purple-600"}`}>Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!loggedIn) return <LoginForm onLogin={() => setLoggedIn(true)} darkMode={darkMode} />;

  return (
    <Router>
      <div className={darkMode ? "dark" : ""}>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 relative transition-colors">
          <Navbar
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            onLogout={() => setShowLogoutConfirm(true)}
          />
          <div className="pt-12">
            <Routes>
              <Route index element={<Home darkMode={darkMode} />} />
              <Route
                path="dashboard"
                element={
                  <Dashboard
                    servers={servers}
                    startServer={startServer}
                    stopServer={stopServer}
                    sendCommand={sendCommand}
                    darkMode={darkMode}
                  />
                }
              />
              <Route
                path="dashboard/:serverName"
                element={
                  <ServerDetailPage
                    servers={servers}
                    startServer={startServer}
                    stopServer={stopServer}
                    sendCommand={sendCommand}
                    darkMode={darkMode}
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
