import React, { useState } from "react";
import { LayoutGrid, List } from "lucide-react"; // iconos opcionales
import ServerCard from "../components/ServerCard.jsx";
import ServerDetail from "../components/ServerDetail.jsx";

export default function Dashboard({
  servers,
  activeServer,
  setActiveServer,
  startServer,
  stopServer
}) {
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"

  return (
    <div className="max-w-7xl mx-auto mt-6">
      {activeServer ? (
        <ServerDetail
          server={activeServer}
          data={servers[activeServer]}
          onStart={startServer}
          onStop={stopServer}
          onBack={() => setActiveServer(null)}
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              Panel de Servidores Minecraft
            </h1>

            {/* Botones para cambiar vista */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg ${
                  viewMode === "grid"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg ${
                  viewMode === "list"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <List size={20} />
              </button>
            </div>
          </div>

          {/* Renderizado condicional */}
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                : "flex flex-col gap-4"
            }
          >
            {Object.entries(servers).map(([name, data]) => (
              <ServerCard
                key={name}
                server={name}
                data={data}
                onStart={startServer}
                onStop={stopServer}
                onOpen={() => setActiveServer(name)}
                // Puedes pasar un prop "compact" si quieres que cambie el diseño en lista
                compact={viewMode === "list"}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
