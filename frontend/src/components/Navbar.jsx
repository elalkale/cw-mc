import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Moon, Sun, LogOut, Menu, X, Home, LayoutDashboard, Settings as SettingsIcon, BookOpen, Users } from "lucide-react";
import Settings from "./Settings.jsx";

export default function Navbar({ darkMode, toggleDarkMode, onLogout, logoutBtnRef }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const location = useLocation();

  // Cerrar sidebar con Escape (WCAG 2.1.2 – No Keyboard Trap)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Cerrar sidebar al cambiar de ruta (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  const navLinkClass = (path) => {
    const active = location.pathname === path ||
      (path !== '/' && location.pathname.startsWith(path));
    return `inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${active
      ? darkMode
        ? "bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-purple-300 border border-purple-500/25 shadow-sm shadow-purple-900/20"
        : "bg-gradient-to-r from-purple-100 to-pink-50 text-purple-700 border border-purple-200/80 shadow-sm shadow-purple-100"
      : darkMode
        ? "text-gray-400 hover:text-gray-200 hover:bg-white/6 border border-transparent"
        : "text-gray-500 hover:text-gray-800 hover:bg-gray-100/80 border border-transparent"
      }`;
  };

  return (
    <div className="relative z-50">
      {/* ── Navbar superior ── */}
      <nav
        className={`fixed top-0 w-full shadow-lg z-50 transition-all duration-300 h-12 md:h-14 flex items-center ${darkMode
          ? "bg-gradient-to-r from-gray-800 to-gray-900 text-white"
          : "bg-gradient-to-r from-white to-gray-50 text-gray-800"
          } border-b border-purple-500/20`}
        aria-label="Navegación principal"
      >
        <div className="max-w-7xl mx-auto px-2 md:px-4 flex items-center justify-between w-full gap-4">

          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 flex-shrink-0 group"
            aria-label="Ir a inicio – Minecraft Panel"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all group-hover:scale-105 group-hover:shadow-md ${darkMode ? "bg-purple-500/20 shadow-purple-900/30" : "bg-purple-100 shadow-purple-200/50"}`}>
              <img
                src="/frontend/src/assets/icon.png"
                alt=""
                className="w-4.5 h-4.5 object-contain"
                aria-hidden="true"
              />
            </div>
            <span className="text-sm font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent hidden sm:inline tracking-tight">
              Cube Watcher
            </span>
          </Link>

          {/* Separador vertical */}
          <div className={`hidden md:block w-px h-5 mx-1 ${darkMode ? "bg-white/10" : "bg-gray-200"}`} aria-hidden="true" />

          {/* ── Links de navegación en ESCRITORIO (ocultos en móvil) ── */}
          <nav
            className="hidden md:flex items-center gap-0.5 flex-1"
            aria-label="Páginas principales"
          >
            <Link to="/" className={navLinkClass("/")}>
              <Home size={14} className="mr-1.5" aria-hidden="true" /> Inicio
            </Link>
            <Link to="/dashboard" className={navLinkClass("/dashboard")}>
              <LayoutDashboard size={14} className="mr-1.5" aria-hidden="true" /> Dashboard
            </Link>
            <Link to="/catalog" className={navLinkClass("/catalog")}>
              <BookOpen size={14} className="mr-1.5" aria-hidden="true" /> Catálogo
            </Link>
            <Link to="/about" className={navLinkClass("/about")}>
              <Users size={14} className="mr-1.5" aria-hidden="true" /> Acerca de
            </Link>
          </nav>

          {/* ── Acciones ── */}
          <div className="flex items-center gap-1">

            {/* Grupo de botones: dark mode + settings + logout */}
            <div className={`flex items-center gap-0.5 px-1 py-1 rounded-xl border ${darkMode ? "bg-white/5 border-white/10" : "bg-gray-100/80 border-gray-200"}`}>
              <button
                onClick={toggleDarkMode}
                className={`p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 ${darkMode
                  ? "text-purple-300 hover:bg-purple-500/20"
                  : "text-gray-500 hover:bg-white hover:text-purple-600 hover:shadow-sm"
                }`}
                aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                aria-pressed={darkMode}
              >
                {darkMode ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              </button>

              <div className={`w-px h-4 ${darkMode ? "bg-white/10" : "bg-gray-300"}`} aria-hidden="true" />

              <button
                onClick={() => setIsSettingsOpen(true)}
                className={`p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 ${darkMode
                  ? "text-gray-400 hover:bg-white/8 hover:text-gray-200"
                  : "text-gray-500 hover:bg-white hover:text-gray-800 hover:shadow-sm"
                }`}
                aria-label="Abrir configuración"
              >
                <SettingsIcon size={16} aria-hidden="true" />
              </button>

              <div className={`w-px h-4 ${darkMode ? "bg-white/10" : "bg-gray-300"}`} aria-hidden="true" />

              <button
                ref={logoutBtnRef}
                onClick={onLogout}
                className={`p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 ${darkMode
                  ? "text-red-400 hover:bg-red-500/15 hover:text-red-300"
                  : "text-red-400 hover:bg-red-50 hover:text-red-600 hover:shadow-sm"
                }`}
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Modal de configuración */}
            {isSettingsOpen && (
              <>
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setIsSettingsOpen(false)} />
                <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
                  <div
                    className={`w-full max-w-md rounded-2xl shadow-2xl border pointer-events-auto ${darkMode
                      ? "bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/25"
                      : "bg-white border-gray-200"
                    }`}
                    onClick={e => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="settings-title"
                  >
                    <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? "border-gray-700/60" : "border-gray-200"}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? "bg-purple-500/15" : "bg-purple-100"}`}>
                          <SettingsIcon size={14} className="text-purple-400" />
                        </div>
                        <h3 id="settings-title" className={`font-semibold text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>
                          Configuración
                        </h3>
                      </div>
                      <button
                        onClick={() => setIsSettingsOpen(false)}
                        className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                        aria-label="Cerrar configuración"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="px-5 py-4">
                      <Settings darkMode={darkMode} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Hamburger — solo visible en MÓVIL */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 rounded-xl md:hidden transition-all hover:scale-105 active:scale-95 ${darkMode
                ? "text-gray-400 hover:bg-white/8 hover:text-gray-200"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              }`}
              aria-label={isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
              aria-expanded={isOpen}
              aria-controls="sidebar-menu"
            >
              {isOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Sidebar lateral — solo en MÓVIL ── */}
      <div
        id="sidebar-menu"
        aria-hidden={!isOpen}
        className={`fixed top-12 left-0 w-64 p-4 transform ${isOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-300 ease-in-out z-40 md:hidden flex flex-col h-[calc(100%-3rem)] ${darkMode
            ? "bg-gradient-to-b from-gray-800 to-gray-900 text-white border-r border-purple-500/20"
            : "bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900 border-r border-purple-500/20"
          }`}
      >
        <div>
          <h2 className="text-lg font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Menú de navegación
          </h2>

          <nav className="flex flex-col space-y-2" aria-label="Páginas principales (móvil)">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg transition ${darkMode
                ? "text-gray-300 hover:text-purple-300 hover:bg-purple-500/20"
                : "text-gray-600 hover:text-purple-600 hover:bg-purple-200/30"
                }`}
              tabIndex={isOpen ? 0 : -1}
            >
              <span className="inline-flex items-center gap-2"><Home size={16} aria-hidden="true" /> Inicio</span>
            </Link>
            <Link
              to="/dashboard"
              className={`px-4 py-2 rounded-lg transition ${darkMode
                ? "text-gray-300 hover:text-purple-300 hover:bg-purple-500/20"
                : "text-gray-600 hover:text-purple-600 hover:bg-purple-200/30"
                }`}
              tabIndex={isOpen ? 0 : -1}
            >
              <span className="inline-flex items-center gap-2"><LayoutDashboard size={16} aria-hidden="true" /> Dashboard</span>
            </Link>
            <Link
              to="/catalog"
              className={`px-4 py-2 rounded-lg transition ${darkMode
                ? "text-gray-300 hover:text-purple-300 hover:bg-purple-500/20"
                : "text-gray-600 hover:text-purple-600 hover:bg-purple-200/30"
                }`}
              tabIndex={isOpen ? 0 : -1}
            >
              <span className="inline-flex items-center gap-2"><BookOpen size={16} aria-hidden="true" /> Catálogo</span>
            </Link>
            <Link
              to="/about"
              className={`px-4 py-2 rounded-lg transition ${darkMode
                ? "text-gray-300 hover:text-purple-300 hover:bg-purple-500/20"
                : "text-gray-600 hover:text-purple-600 hover:bg-purple-200/30"
                }`}
              tabIndex={isOpen ? 0 : -1}
            >
              <span className="inline-flex items-center gap-2"><Users size={16} aria-hidden="true" /> Acerca de</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Overlay oscuro (solo móvil, cuando sidebar abierto) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
