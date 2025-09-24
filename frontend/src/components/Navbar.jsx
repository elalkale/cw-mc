import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaMoon, FaEllipsisV } from "react-icons/fa";
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
      {/* Navbar superior compacto */}
      <nav
        className={`fixed top-0 w-full shadow-md z-50 transition-transform duration-300 h-12 flex items-center ${
          darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-800"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between w-full">
          {/* Botón menú hamburguesa */}
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            {isOpen ? <X className={`${darkMode ? "text-white" : "text-gray-800"}`} /> : <Menu className={`${darkMode ? "text-white" : "text-gray-800"}`} />}
          </button>

          {/* Logo */}
          <Link
            to="/"
            className="text-lg font-bold text-purple-600 dark:text-purple-400 hover:underline"
            onClick={closeSidebar}
          >
            Panel Minecraft
          </Link>

          {/* Acciones (modo oscuro) */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className={`p-1 rounded-full transition-colors duration-300 ${
                darkMode
                  ? "bg-purple-600 text-white"
                  : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
              }`}
            >
              <FaMoon />
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar lateral */}
      <div
        className={`fixed top-12 left-0 w-64 p-4 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out z-40 flex flex-col h-[calc(100%-3rem)] ${
          darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
        }`}
      >
        {/* Contenido arriba */}
        <div>
          <h2 className="text-lg font-bold mb-4 flex justify-between items-center">
            Menú
            <button
              onClick={closeSidebar}
              className={`p-1 rounded ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"}`}
            >
             
            </button>
          </h2>

          <nav className="flex flex-col space-y-3">
            <Link
              to="/"
              className={`hover:${darkMode ? "text-purple-400" : "text-purple-600"}`}
              onClick={closeSidebar}
            >
              Home
            </Link>
            <Link
              to="/dashboard"
              className={`hover:${darkMode ? "text-purple-400" : "text-purple-600"}`}
              onClick={closeSidebar}
            >
              Dashboard
            </Link>
          </nav>
        </div>

        {/* Botón fijo abajo */}
        <button
          onClick={() => {
            onLogout();
            closeSidebar();
          }}
          className={`mt-auto w-full text-left px-4 py-2 rounded-lg font-semibold transition ${
            darkMode
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
