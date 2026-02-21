import React, { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import ServerCard from "../components/ServerCard.jsx";

export default function Dashboard({
  servers,
  startServer,
  stopServer,
  sendCommand,
  darkMode
}) {
  const [viewMode, setViewMode] = useState("grid");

  return (
    <div className={`max-w-7xl mx-auto mt-2 md:mt-6 px-4 md:px-6 transition-colors duration-300 py-4 rounded-lg ${
      darkMode ? "bg-gray-900" : "bg-gray-50"
    }`}>
      <div className="flex items-center justify-between mb-8 flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Panel de Servidores
          </h1>
          <p className={`text-sm md:text-base transition-colors ${
            darkMode ? "text-gray-400" : "text-gray-700"
          }`}>Gestiona tus servidores de Minecraft</p>
        </div>

        <div className={`flex gap-2 p-1 rounded-lg backdrop-blur-sm border transition-colors ${
          darkMode ? "bg-gray-800/50 border-purple-500/20" : "bg-gray-200 border-purple-400/50"
        }`}>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-2 rounded-md transition flex items-center gap-2 ${
              viewMode === "grid"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                : darkMode
                ? "text-gray-400 hover:text-gray-300"
                : "text-gray-700 hover:text-gray-900"
            }`}
          >
            <LayoutGrid size={18} />
            <span className="hidden sm:inline text-sm">Grid</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-2 rounded-md transition flex items-center gap-2 ${
              viewMode === "list"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                : darkMode
                ? "text-gray-400 hover:text-gray-300"
                : "text-gray-700 hover:text-gray-900"
            }`}
          >
            <List size={18} />
            <span className="hidden sm:inline text-sm">Lista</span>
          </button>
        </div>
      </div>

      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-2 px-3"
            : darkMode
                ? "text-gray-400 hover:text-gray-300"
                : "text-gray-700 hover:text-gray-900"
        }
      >
        {Object.entries(servers).map(([name, data]) => (
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
    </div>
  );
}
