import React, { useState, useRef, useEffect } from 'react';
import { FaMoon, FaEllipsisV } from 'react-icons/fa';
import { Link } from 'react-router-dom'; // 👈 importar Link

export default function Navbar({ darkMode, toggleDarkMode, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Cerrar el menú si se hace click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 w-full bg-white dark:bg-gray-800 shadow-md z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">

        {/* Logo o título con Link a Home */}
        <Link to="/" className="text-xl font-bold text-purple-600 dark:text-purple-400 hover:underline">
          Panel Minecraft
        </Link>

        <div className="flex items-center gap-4 relative">
          {/* Botón modo oscuro */}
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full transition-colors duration-300 ${
              darkMode
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            <FaMoon />
          </button>

          {/* Icono de tres puntitos */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <FaEllipsisV />
            </button>

            {/* Menú dropdown */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
