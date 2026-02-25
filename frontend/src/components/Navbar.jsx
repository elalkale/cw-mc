import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaMoon, FaSignOutAlt } from "react-icons/fa";
import { Menu, X, Home, LayoutDashboard, Settings as SettingsIcon, BookOpen } from "lucide-react";
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
    const active = location.pathname === path;
    return `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active
      ? "bg-purple-600/80 text-white"
      : darkMode
        ? "text-gray-300 hover:text-purple-300 hover:bg-purple-500/20"
        : "text-gray-600 hover:text-purple-600 hover:bg-purple-200/30"
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
            className="flex items-center gap-2 text-sm md:text-lg font-bold
            bg-gradient-to-r from-purple-400 to-pink-400
            bg-clip-text text-transparent hover:opacity-80 transition flex-shrink-0"
            aria-label="Ir a inicio – Minecraft Panel"
          >
            <img
              src="/frontend/src/assets/icon.png"
              alt=""
              className="w-6 h-6 object-contain"
              aria-hidden="true"
            />
            Cube Watcher
          </Link>

          {/* ── Links de navegación en ESCRITORIO (ocultos en móvil) ── */}
          <nav
            className="hidden md:flex items-center gap-1 flex-1"
            aria-label="Páginas principales"
          >
            <Link to="/" className={navLinkClass("/")}>
              <span className="inline-flex items-center gap-1.5"><Home size={15} aria-hidden="true" /> Inicio</span>
            </Link>
            <Link to="/dashboard" className={navLinkClass("/dashboard")}>
              <span className="inline-flex items-center gap-1.5"><LayoutDashboard size={15} aria-hidden="true" /> Dashboard</span>
            </Link>
            <Link to="/catalog" className={navLinkClass("/catalog")}>
              <span className="inline-flex items-center gap-1.5"><BookOpen size={15} aria-hidden="true" /> Catálogo</span>
            </Link>
          </nav>

          {/* ── Acciones ── */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className={`p-1.5 rounded-full transition-colors duration-300 ${darkMode
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-800"
                }`}
              aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-pressed={darkMode}
            >
              <FaMoon aria-hidden="true" />
            </button>

            <button
              ref={logoutBtnRef}
              onClick={onLogout}
              className="p-1.5 rounded-full transition-colors duration-300 bg-red-600 hover:bg-red-700 text-white"
              aria-label="Cerrar sesión"
            >
              <FaSignOutAlt aria-hidden="true" />
            </button>

            {/* Botón de configuración */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-full transition-colors duration-300 bg-blue-600 hover:bg-blue-700 text-white"
              aria-label="Abrir configuración"
            >
              <SettingsIcon size={20} aria-hidden="true" />
            </button>

            {/* Modal de configuración */}
            {isSettingsOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="settings-title">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white rounded-2xl shadow-lg p-6 w-full max-w-md relative border border-purple-500/20">
                  <button
                    className="absolute top-2 right-2 p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                    aria-label="Cerrar configuración"
                    onClick={() => setIsSettingsOpen(false)}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                  <Settings darkMode={darkMode}/>
                </div>
              </div>
            )}

            {/* Hamburger — solo visible en MÓVIL */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-1.5 rounded-full md:hidden transition-colors duration-300 ${darkMode
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              aria-label={isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
              aria-expanded={isOpen}
              aria-controls="sidebar-menu"
            >
              {isOpen
                ? <X size={20} aria-hidden="true" />
                : <Menu size={20} aria-hidden="true" />}
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
