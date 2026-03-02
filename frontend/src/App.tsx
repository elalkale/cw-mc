import React, { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { fetchWithToken } from "./lib/api";
import { POLL_INTERVAL_MS, INSTALL_POLL_MS, API } from "./constants";
import { ServersMap, InstallState, CreationState } from "./types";
import { useFocusTrap } from "./hooks/useFocusTrap";

import { LogOut, X } from "lucide-react";
import LoginForm    from "./components/LoginForm";
import Navbar       from "./components/Navbar";
import Home         from "./pages/Home";
import Dashboard    from "./pages/Dashboard";
import ServerDetailPage from "./pages/ServerDetailPage";
import ServerCatalog    from "./pages/ServerCatalog";
import ModpackDetail    from "./pages/ModpackDetail";
import About            from "./pages/About";
import ErrorBoundary    from "./components/common/ErrorBoundary";

type InstallationsMap = Record<string, InstallState>;
type CreationsMap = Record<string, CreationState>;

export default function App() {
  const [loggedIn, setLoggedIn]       = useState(false);
  const [servers, setServers]         = useState<ServersMap>({});
  const [installations, setInstallations] = useState<InstallationsMap>(() => {
    try {
      const saved = localStorage.getItem('cw-installations');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [creations, setCreations] = useState<CreationsMap>(() => {
    try {
      const saved = localStorage.getItem('cw-creations');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true;
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loading, setLoading]         = useState(true);
  const logoutBtnRef                  = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Persiste solo las instalaciones en curso
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

  // Persiste solo las creaciones en curso
  useEffect(() => {
    const pending = Object.fromEntries(
      Object.entries(creations).filter(([, v]) => v.status === 'creating')
    );
    if (Object.keys(pending).length === 0) {
      localStorage.removeItem('cw-creations');
    } else {
      localStorage.setItem('cw-creations', JSON.stringify(pending));
    }
  }, [creations]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const fetchStatus = async () => {
    try {
      const res = await fetchWithToken(API.STATUS);
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
        const res = await fetchWithToken(API.ME);
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
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loggedIn]);

  // Polling global de instalaciones
  const installationsRef = useRef(installations);
  useEffect(() => { installationsRef.current = installations; }, [installations]);

  useEffect(() => {
    if (!loggedIn) return;
    const interval = setInterval(async () => {
      const pending = Object.entries(installationsRef.current)
        .filter(([, v]) => v.status === 'installing');
      for (const [installId] of pending) {
        try {
          const res = await fetchWithToken(API.INSTALL_STATUS(installId));
          if (!res.ok) {
            const msg = res.status === 404
              ? 'Instalación perdida (servidor reiniciado)'
              : `Error inesperado (${res.status})`;
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
    }, INSTALL_POLL_MS);
    return () => clearInterval(interval);
  }, [loggedIn]);

  // Polling global de creaciones de servidor
  const creationsRef = useRef(creations);
  useEffect(() => { creationsRef.current = creations; }, [creations]);

  useEffect(() => {
    if (!loggedIn) return;
    const interval = setInterval(async () => {
      const pending = Object.entries(creationsRef.current)
        .filter(([, v]) => v.status === 'creating');
      for (const [creationId] of pending) {
        try {
          const res = await fetchWithToken(API.CREATE_SERVER_STATUS(creationId));
          if (!res.ok) {
            const msg = res.status === 404
              ? 'Creación perdida (servidor reiniciado)'
              : `Error inesperado (${res.status})`;
            setCreations(prev => ({
              ...prev,
              [creationId]: { ...prev[creationId], status: 'error', error: msg },
            }));
            continue;
          }
          const data = await res.json();
          if (data.status === 'done' || data.status === 'error') {
            setCreations(prev => ({
              ...prev,
              [creationId]: { ...prev[creationId], status: data.status, error: data.error },
            }));
          }
        } catch { /* error de red, reintenta en el siguiente ciclo */ }
      }
    }, INSTALL_POLL_MS);
    return () => clearInterval(interval);
  }, [loggedIn]);

  const startServer = async (name: string) => {
    await fetchWithToken(API.START, { method: "POST", body: JSON.stringify({ name }) });
    setTimeout(fetchStatus, 1000);
  };

  const stopServer = async (name: string) => {
    await fetchWithToken(API.STOP, { method: "POST", body: JSON.stringify({ name }) });
    setTimeout(fetchStatus, 1000);
  };

  const forceStopServer = async (name: string) => {
    await fetchWithToken(API.FORCE_STOP, { method: "POST", body: JSON.stringify({ name }) });
    setTimeout(fetchStatus, 1000);
  };

  const sendCommand = async (name: string, command: string) => {
    try {
      await fetchWithToken(API.COMMAND, { method: "POST", body: JSON.stringify({ name, command }) });
    } catch (err) {
      console.error("Error sendCommand:", err);
    }
  };

  const addInstall = useCallback((installId: string, info: Partial<InstallState>) => {
    setInstallations(prev => ({ ...prev, [installId]: { status: 'installing', ...info } as InstallState }));
  }, []);

  const clearInstall = useCallback((installId: string) => {
    setInstallations(prev => {
      const next = { ...prev };
      delete next[installId];
      return next;
    });
  }, []);

  const addCreation = useCallback((creationId: string, info: Partial<CreationState>) => {
    setCreations(prev => ({ ...prev, [creationId]: { status: 'creating', ...info } as CreationState }));
  }, []);

  const clearCreation = useCallback((creationId: string) => {
    setCreations(prev => {
      const next = { ...prev };
      delete next[creationId];
      return next;
    });
  }, []);

  const openLogoutModal  = () => setShowLogoutConfirm(true);
  const closeLogoutModal = useCallback(() => {
    setShowLogoutConfirm(false);
    logoutBtnRef.current?.focus();
  }, []);

  const logout = async () => {
    await fetchWithToken(API.LOGOUT, { method: "POST" });
    localStorage.removeItem('authToken');
    window.history.replaceState(null, '', '/');
    setLoggedIn(false);
    setShowLogoutConfirm(false);
  };

  useEffect(() => {
    if (!showLogoutConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLogoutModal(); };
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
            <ErrorBoundary>
              <Routes>
                <Route index element={<Home darkMode={darkMode} />} />
                <Route
                  path="dashboard"
                  element={
                    <Dashboard
                      servers={servers}
                      startServer={startServer}
                      stopServer={stopServer}
                      darkMode={darkMode}
                      installations={installations}
                      creations={creations}
                      onCreationStart={addCreation}
                      onCreationClear={clearCreation}
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
                <Route
                  path="catalog/:modId"
                  element={
                    <ModpackDetail
                      darkMode={darkMode}
                      onInstallStart={addInstall}
                      onInstallClear={clearInstall}
                      installations={installations}
                    />
                  }
                />
                <Route path="about" element={<About darkMode={darkMode} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </main>

          {/* Modal de confirmación de logout */}
          {showLogoutConfirm && (
            <>
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                aria-hidden="true"
                onClick={closeLogoutModal}
              />
              <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
                <div
                  ref={modalRef as React.RefObject<HTMLDivElement>}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="logout-confirm-title"
                  className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30'
                    : 'bg-white border-purple-200/70'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-red-500/15' : 'bg-red-100'}`}>
                        <LogOut size={14} className="text-red-400" aria-hidden="true" />
                      </div>
                      <h3 id="logout-confirm-title" className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        Cerrar sesión
                      </h3>
                    </div>
                    <button
                      onClick={closeLogoutModal}
                      aria-label="Cancelar, permanecer en la sesión"
                      className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="px-5 py-4">
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      ¿Seguro que quieres cerrar sesión?
                    </p>
                  </div>

                  {/* Footer */}
                  <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                    <button
                      onClick={closeLogoutModal}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={logout}
                      aria-label="Confirmar cierre de sesión"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white transition-all shadow-md shadow-red-900/20"
                    >
                      <LogOut size={14} aria-hidden="true" />
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
