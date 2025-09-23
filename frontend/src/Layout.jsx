import React, { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Navbar from "./components/Navbar.jsx";

export default function Layout({ darkMode, toggleDarkMode, onLogout }) {
  const [isOpen, setIsOpen] = useState(true); // abierto por defecto en PC

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div
        className={`bg-gray-800 text-white w-64 p-4 fixed inset-y-0 left-0 transform
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        transition-transform duration-300 ease-in-out z-20`}
      >
        <h2 className="text-xl font-bold mb-6 flex justify-between items-center">
          Menú
          <button onClick={closeMenu} className="p-1 rounded hover:bg-gray-700">
            <X />
          </button>
        </h2>
        <nav className="flex flex-col space-y-4">
          <Link to="/" className="hover:text-purple-400" onClick={closeMenu}>
            Home
          </Link>
          <Link
            to="/dashboard"
            className="hover:text-purple-400"
            onClick={closeMenu}
          >
            Dashboard
          </Link>
        </nav>
      </div>

      {/* Content */}
      <div
        className={`flex-1 bg-gray-100 dark:bg-gray-900 flex flex-col transition-all duration-300
        ${isOpen ? "md:ml-64" : "ml-0"}`}
      >
        {/* Botón toggle */}
        <button
          className="m-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md z-30"
          onClick={toggleMenu}
        >
          {isOpen ? <X /> : <Menu />}
        </button>

        {/* Navbar fijo arriba */}
        <Navbar
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          onLogout={onLogout}
        />

        {/* Contenido principal */}
        <div className="p-6 flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
