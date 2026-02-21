import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaMoon, FaSignOutAlt } from "react-icons/fa";
import { Menu, X } from "lucide-react";

export default function Navbar({ darkMode, toggleDarkMode, onLogout }) {
  const [isOpen, setIsOpen] = useState(false); // menú lateral
  const [menuOpen, setMenuOpen] = useState(false); // menú dropdown usuario
  const menuRef = useRef(null);

  // Cerrar el dropdown si se hace click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  
  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

 return (
    <div className="relative z-50">
      {/* Navbar superior */}
      <nav
        className={`fixed top-0 w-full shadow-lg z-50 transition-all duration-300 h-12 md:h-14 flex items-center ${
          darkMode ? "bg-gradient-to-r from-gray-800 to-gray-900 text-white" : "bg-gradient-to-r from-white to-gray-50 text-gray-800"
        } border-b border-purple-500/20`}
      >
        <div className="max-w-7xl mx-auto px-2 md:px-4 flex items-center justify-between w-full">
          <Link
  to="/"
  className="flex items-center gap-2 text-sm md:text-lg font-bold 
  bg-gradient-to-r from-purple-400 to-pink-400 
  bg-clip-text text-transparent hover:opacity-80 transition"
  onClick={closeSidebar}
>
  <img
    src="frontend/src/assets/icon.png"
    alt="Logo"
    className="w-6 h-6 object-contain"
  />
  Minecraft Panel
</Link>

          {/* Acciones (modo oscuro + logout) */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className={`p-1 rounded-full transition-colors duration-300 ${
                darkMode
                  ? "bg-purple-600 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
              title="Cambiar tema"
            >
              <FaMoon />
            </button>

            <button
              onClick={onLogout}
              className="p-1 rounded-full transition-colors duration-300 bg-red-600 hover:bg-red-700 text-white"
              title="Cerrar sesión"
            >
              <FaSignOutAlt />
            </button>

            <button
              onClick={toggleSidebar}
              className={`p-1 rounded-full md:hidden transition-colors duration-300 ${
                darkMode
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar lateral */}
      <div
        className={`fixed top-12 md:top-14 left-0 w-64 p-4 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out z-40 flex flex-col h-[calc(100%-3rem)] md:h-[calc(100%-3.5rem)] ${
          darkMode ? "bg-gradient-to-b from-gray-800 to-gray-900 text-white border-r border-purple-500/20" : "bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900 border-r border-purple-500/20"
        }`}
      >
        {/* Contenido arriba */}
        <div>
          <h2 className="text-lg font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Menú de navegación
          </h2>

          <nav className="flex flex-col space-y-2">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg transition ${
                darkMode
                  ? "text-gray-300 hover:text-purple-300 hover:bg-purple-500/20"
                  : "text-gray-600 hover:text-purple-600 hover:bg-purple-200/30"
              }`}
              onClick={closeSidebar}
            >
              🏠 Inicio
            </Link>
            <Link
              to="/dashboard"
              className={`px-4 py-2 rounded-lg transition ${
                darkMode
                  ? "text-gray-300 hover:text-purple-300 hover:bg-purple-500/20"
                  : "text-gray-600 hover:text-purple-600 hover:bg-purple-200/30"
              }`}
              onClick={closeSidebar}
            >
              🎮 Dashboard
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
