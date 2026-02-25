import React, { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { API_BASE, fetchWithToken } from "./lib/api.js";
import LoginForm from "./components/LoginForm.jsx";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ServerDetailPage from "./pages/ServerDetailPage.jsx";
import ServerCatalog from "./pages/ServerCatalog.jsx";
import ModpackDetail from "./pages/ModpackDetail.jsx";
import Navbar from "./components/Navbar.jsx";

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

    first?.focus();

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      if (focusable.length === 0) { e.preventDefault(); return; }

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
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
  const [installations, setInstallations] = useState(() => {
    try {
      const saved = localStorage.getItem('cw-installations');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true;
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  const logoutBtnRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Persiste solo las instalaciones en curso (no las finalizadas)
  useEffect(() => {
    const pending = Object.fromEntries(
      Object.entries(installations).filter(([, v]) => v.status === 'installing')
    );
    if (Object.keys(pending).length === 0) {
      localStorage.removeItem('cw-installations');
    } else {
      localStorage.setItem('cw-installations', JSON.stringify(pending));
    }
  }, [installations]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const fetchStatus = async () => {
    try {
      const res = await fetchWithToken(`${API_BASE}/api/status`);
      if (res.ok) {
        setServers(await res.json());
      } else if (res.status === 401) {
        setLoggedIn(false);
      }
    } catch (err) {
      console.error("Error fetchStatus:", err);
    }
  };

  // Verificar sesión al cargar
  useEffect(() => {
    const verifySession = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) { setLoading(false); return; }

        const res = await fetchWithToken(`${API_BASE}/api/me`);
        if (res.ok) {
          const data = await res.json();
          if (data.loggedIn) setLoggedIn(true);
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
    if (!loggedIn) return;
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  // Polling global de instalaciones — funciona aunque el usuario navegue o recargue
  const installationsRef = useRef(installations);
  useEffect(() => { installationsRef.current = installations; }, [installations]);

  useEffect(() => {
    if (!loggedIn) return;
    const interval = setInterval(async () => {
      const pending = Object.entries(installationsRef.current)
        .filter(([, v]) => v.status === 'installing');
      for (const [installId] of pending) {
        try {
          const res = await fetchWithToken(`${API_BASE}/api/install/${installId}`);
          if (!res.ok) {
            // 404 = backend reiniciado y perdió el estado → marcar como error para limpiar localStorage
            const msg = res.status === 404 ? 'Instalación perdida (servidor reiniciado)' : `Error inesperado (${res.status})`;
            setInstallations(prev => ({
              ...prev,
              [installId]: { ...prev[installId], status: 'error', error: msg },
            }));
            continue;
          }
          const data = await res.json();
          if (data.status === 'done' || data.status === 'error') {
            setInstallations(prev => ({
              ...prev,
              [installId]: { ...prev[installId], status: data.status, error: data.error },
            }));
          }
        } catch { /* error de red, reintenta en el siguiente ciclo */ }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  const startServer = async (name) => {
    await fetchWithToken(`${API_BASE}/api/start`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setTimeout(fetchStatus, 1000);
  };

  const stopServer = async (name) => {
    await fetchWithToken(`${API_BASE}/api/stop`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setTimeout(fetchStatus, 1000);
  };

  const forceStopServer = async (name) => {
    await fetchWithToken(`${API_BASE}/api/force-stop`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setTimeout(fetchStatus, 1000);
  };

  const sendCommand = async (name, command) => {
    try {
      await fetchWithToken(`${API_BASE}/api/command`, {
        method: "POST",
        body: JSON.stringify({ name, command }),
      });
    } catch (err) {
      console.error("Error sendCommand:", err);
    }
  };

  const addInstall = useCallback((installId, info) => {
    // info.status puede ser 'error' si falló antes de iniciarse; por defecto 'installing'
    setInstallations(prev => ({ ...prev, [installId]: { status: 'installing', ...info } }));
  }, []);

  const clearInstall = useCallback((installId) => {
    setInstallations(prev => {
      const next = { ...prev };
      delete next[installId];
      return next;
    });
  }, []);

  const openLogoutModal = () => setShowLogoutConfirm(true);

  const closeLogoutModal = useCallback(() => {
    setShowLogoutConfirm(false);
    logoutBtnRef.current?.focus();
  }, []);

  const logout = async () => {
    await fetchWithToken(`${API_BASE}/logout`, { method: "POST" });
    localStorage.removeItem('authToken');
    window.history.replaceState(null, '', '/');
    setLoggedIn(false);
    setShowLogoutConfirm(false);
  };

  // Cerrar modal con Escape (WCAG 2.1.2)
  useEffect(() => {
    if (!showLogoutConfirm) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') closeLogoutModal(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutConfirm, closeLogoutModal]);

  const modalRef = useFocusTrap(showLogoutConfirm);

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${darkMode
        ? "bg-gradient-to-br from-purple-900 via-gray-900 to-black"
        : "bg-gradient-to-br from-purple-100 via-white to-purple-50"
      }`}>
        <div className="text-center" role="status" aria-label="Verificando sesión, por favor espere">
          <div
            className={`w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4 ${darkMode
              ? "border-purple-500 border-t-transparent"
              : "border-purple-400 border-t-transparent"
            }`}
            aria-hidden="true"
          />
          <p className={`text-lg font-semibold ${darkMode ? "text-purple-300" : "text-purple-600"}`}>
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
                    installations={installations}
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
                    forceStopServer={forceStopServer}
                    sendCommand={sendCommand}
                    darkMode={darkMode}
                  />
                }
              />
              <Route path="catalog" element={<ServerCatalog darkMode={darkMode} />} />
              <Route path="catalog/:modId" element={<ModpackDetail darkMode={darkMode} onInstallStart={addInstall} onInstallClear={clearInstall} installations={installations} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Modal de confirmación de logout */}
          {showLogoutConfirm && (
            <>
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                aria-hidden="true"
                onClick={closeLogoutModal}
              />
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
