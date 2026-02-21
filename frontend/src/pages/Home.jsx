import React from "react";
import { Link } from "react-router-dom";

export default function Home({ darkMode }) {
  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center text-center p-4 md:p-8 relative overflow-hidden transition-colors ${darkMode
        ? "bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900"
        : "bg-gradient-to-br from-purple-50 via-white to-purple-100"
        }`}
    >
      {/* Elementos decorativos — aria-hidden para no confundir lectores */}
      <div
        className={`absolute top-0 right-0 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse ${darkMode ? "bg-purple-500" : "bg-purple-400"
          }`}
        aria-hidden="true"
      />
      <div
        className={`absolute bottom-0 left-0 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse ${darkMode ? "bg-pink-500" : "bg-pink-400"
          }`}
        style={{ animationDelay: "2s" }}
        aria-hidden="true"
      />

      <div className="relative z-10">
        <img
          src="/frontend/src/assets/logo.png"
          alt="Logo del Panel Minecraft"
          className="w-32 h-32 mx-auto mb-6"
        />

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent mb-4">
          Bienvenido a Cube Watcher
        </h1>

        {/* Era <h2> pero rompe la jerarquía de encabezados — WCAG 1.3.1 */}
        <p
          className={`text-sm sm:text-base md:text-lg font-semibold mb-8 ${darkMode ? "text-purple-300" : "text-purple-700"
            }`}
        >
          Desarrollado por Alejandro S. &amp; Jesús G.
        </p>

        <img
          src="/frontend/src/assets/creators.jpg"
          alt="Alejandro S. y Jesús G., desarrolladores del proyecto"
          className={`w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-3xl mb-8 object-cover shadow-2xl border-4 transition-colors mx-auto ${darkMode ? "border-purple-500/30" : "border-purple-400/50"
            }`}
        />

        <p
          className={`text-sm sm:text-base md:text-lg mb-8 max-w-lg px-2 leading-relaxed mx-auto text-center ${darkMode ? "text-gray-300" : "text-gray-700"
            }`}
        >
          Administra fácilmente tus servidores de Minecraft. Inicia, detén y
          controla cada servidor desde un solo lugar con nuestra interfaz
          intuitiva.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/dashboard"
            className="px-8 py-3 text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold shadow-lg transition transform hover:scale-105 active:scale-95"
            aria-label="Ir al panel de control de servidores"
          >
            Ir al Dashboard
          </Link>
          {/* Botón deshabilitado semánticamente hasta que tenga destino real */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            className={`px-8 py-3 text-base rounded-xl font-semibold shadow-lg transition border opacity-60 cursor-not-allowed ${darkMode
              ? "bg-gray-700/50 text-purple-300 border-purple-500/30"
              : "bg-gray-100 text-purple-700 border-purple-400/50"
              }`}
          >
            Documentación
          </button>
        </div>
      </div>
    </div>
  );
}
