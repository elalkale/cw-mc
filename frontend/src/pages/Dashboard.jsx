import React, { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import ServerCard from "../components/ServerCard.jsx";

function InstallingCard({ info, darkMode }) {
  const done = info.status === 'done';
  const error = info.status === 'error';
  const border = darkMode
    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
    : 'bg-gradient-to-br from-white to-gray-100 border-purple-400/40';

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col shadow-lg ${border}`}>
      {/* Thumbnail / logo */}
      <div className="h-28 bg-gray-900/50 flex items-center justify-center relative overflow-hidden">
        {info.logo ? (
          <img src={info.logo} alt="" className="w-full h-full object-cover opacity-40" />
        ) : (
          <span className="text-5xl opacity-20">📦</span>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {!done && !error && (
            <span className="w-8 h-8 rounded-full border-4 border-t-transparent border-purple-400 animate-spin" />
          )}
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            done  ? 'bg-green-600/80 text-white'
            : error ? 'bg-red-600/80 text-white'
            : 'bg-purple-600/80 text-white'
          }`}>
            {done ? '✓ Instalado' : error ? 'Error' : 'Instalando...'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1">
        <p className={`font-bold text-sm leading-tight line-clamp-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {info.serverName}
        </p>
        <p className={`text-xs line-clamp-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {info.modName}
        </p>
        {error && info.error && (
          <p className="text-xs text-red-400 mt-1 line-clamp-2">{info.error}</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({
  servers,
  startServer,
  stopServer,
  darkMode,
  installations = {},
}) {
  const [viewMode, setViewMode] = useState("grid");
  const activeInstalls = Object.entries(installations).filter(
    ([, info]) => info.status === 'installing' || info.status === 'error'
  );
  const installingNames = new Set(activeInstalls.map(([, info]) => info.serverName));
  // Ocultar servidores que aún están instalándose para no mostrar ambas cards a la vez
  const serverEntries = Object.entries(servers).filter(([name]) => !installingNames.has(name));

  return (
    <div
      className={`max-w-7xl mx-auto mt-2 md:mt-6 px-4 md:px-6 transition-colors duration-300 py-4 rounded-lg ${darkMode ? "bg-gray-900" : "bg-gray-50"
        }`}
    >
      <div className="flex items-center justify-between mb-8 flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Panel de Servidores
          </h1>
          <p
            className={`text-sm md:text-base transition-colors ${darkMode ? "text-gray-400" : "text-gray-700"
              }`}
          >
            Gestiona tus servidores de Minecraft
          </p>
        </div>

        {/* Selector de vista con role="group" (WCAG 4.1.2) */}
        <div
          className={`flex gap-2 p-1 rounded-lg backdrop-blur-sm border transition-colors ${darkMode
            ? "bg-gray-800/50 border-purple-500/20"
            : "bg-gray-200 border-purple-400/50"
            }`}
          role="group"
          aria-label="Modo de vista de servidores"
        >
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-2 rounded-md transition flex items-center gap-2 ${viewMode === "grid"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
              : darkMode
                ? "text-gray-400 hover:text-gray-300"
                : "text-gray-700 hover:text-gray-900"
              }`}
            aria-label="Ver servidores en vista cuadrícula"
            aria-pressed={viewMode === "grid"}
          >
            <LayoutGrid size={18} aria-hidden="true" />
            <span className="hidden sm:inline text-sm">Grid</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-2 rounded-md transition flex items-center gap-2 ${viewMode === "list"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
              : darkMode
                ? "text-gray-400 hover:text-gray-300"
                : "text-gray-700 hover:text-gray-900"
              }`}
            aria-label="Ver servidores en vista lista"
            aria-pressed={viewMode === "list"}
          >
            <List size={18} aria-hidden="true" />
            <span className="hidden sm:inline text-sm">Lista</span>
          </button>
        </div>
      </div>

      {/* Estado vacío accesible con role="status" (WCAG 4.1.3) */}
      {serverEntries.length === 0 && activeInstalls.length === 0 ? (
        <div
          role="status"
          className={`text-center py-16 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
        >
          No hay servidores configurados.
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-2 px-3"
              : "flex flex-col gap-4 py-2 px-3"
          }
          aria-label="Lista de servidores"
        >
          {activeInstalls.map(([installId, info]) => (
            <InstallingCard key={installId} info={info} darkMode={darkMode} />
          ))}
          {serverEntries.map(([name, data]) => (
            <ServerCard
              key={name}
              server={name}
              data={data}
              onStart={startServer}
              onStop={stopServer}
              compact={viewMode === "list"}
              darkMode={darkMode}
            />
          ))}
        </div>
      )}
    </div >
  );
}
