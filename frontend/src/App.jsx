// App.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
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

// ─────────────────────────────────────────────────────────────
// Focus Trap hook – mantiene el foco dentro del modal (WCAG 2.1.2)
// ─────────────────────────────────────────────────────────────
function useFocusTrap(active) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const focusable = containerRef.current.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Mover el foco al primer elemento del modal al abrirse
    first?.focus();

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      if (focusable.length === 0) { e.preventDefault(); return; }

      if (e.shiftKey) {
        // Shift+Tab: si estamos en el primero → saltar al último
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        // Tab: si estamos en el último → saltar al primero
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  return containerRef;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [servers, setServers] = useState({});
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true; // Por defecto dark mode
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ref al botón que abre el modal (para devolver el foco al cerrar)
  const logoutBtnRef = useRef(null);

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

  const openLogoutModal = () => {
    setShowLogoutConfirm(true);
  };

  const closeLogoutModal = useCallback(() => {
    setShowLogoutConfirm(false);
    // Devolver el foco al botón que abrió el modal (WCAG 2.4.3)
    logoutBtnRef.current?.focus();
  }, []);

  const logout = async () => {
    await fetchWithToken("http://localhost:4000/logout", {
      method: "POST",
    });
    localStorage.removeItem('authToken');
    // Resetear la URL a / para que el nuevo Router empiece desde la raíz
    // y los assets no fallen al resolver rutas relativas (WCAG no relevante, bug fix)
    window.history.replaceState(null, '', '/');
    setLoggedIn(false);
    setShowLogoutConfirm(false);
  };

  // Cerrar modal con Escape (WCAG 2.1.2 – No Keyboard Trap)
  useEffect(() => {
    if (!showLogoutConfirm) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeLogoutModal();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutConfirm, closeLogoutModal]);

  // Focus trap para el modal
  const modalRef = useFocusTrap(showLogoutConfirm);

  // Spinner de carga inicial
  if (loading) {
    return (
      <div
        className={`flex items-center justify-center min-h-screen ${darkMode
          ? "bg-gradient-to-br from-purple-900 via-gray-900 to-black"
          : "bg-gradient-to-br from-purple-100 via-white to-purple-50"
          }`}
      >
        {/* role="status" + aria-label para lectores de pantalla (WCAG 4.1.3) */}
        <div
          className="text-center"
          role="status"
          aria-label="Verificando sesión, por favor espere"
        >
          <div
            className={`w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4 ${darkMode
              ? "border-purple-500 border-t-transparent"
              : "border-purple-400 border-t-transparent"
              }`}
            aria-hidden="true"
          />
          <p
            className={`text-lg font-semibold ${darkMode ? "text-purple-300" : "text-purple-600"
              }`}
          >
            Verificando sesión...
          </p>
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
            onLogout={openLogoutModal}
            logoutBtnRef={logoutBtnRef}
          />
          <main id="main-content" className="pt-12">
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
          </main>

          {/* Modal de confirmación de logout */}
          {showLogoutConfirm && (
            <>
              {/* Overlay con aria-hidden (el foco no puede entrar aquí) */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                aria-hidden="true"
                onClick={closeLogoutModal}
              />
              {/* El modal queda encima del overlay, con focus trap activado */}
              <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-confirm-title"
                className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
              >
                <div
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-80 pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3
                    id="logout-confirm-title"
                    className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4"
                  >
                    ¿Seguro que quieres cerrar sesión?
                  </h3>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeLogoutModal}
                      className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
                      aria-label="Cancelar, permanecer en la sesión"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={logout}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
                      aria-label="Confirmar cierre de sesión"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Router>
  );
}
