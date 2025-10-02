import React, { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import ServerCard from "../components/ServerCard.jsx";
import ServerDetail from "../components/ServerDetail.jsx";

export default function Dashboard({
  servers,
  activeServer,
  setActiveServer,
  startServer,
  stopServer,
  sendCommand
}) {
  const [viewMode, setViewMode] = useState("grid");

  return (
    <div className="max-w-7xl mx-auto mt-6">
      {activeServer ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-6">
            <ServerDetail
              server={activeServer}
              data={servers[activeServer]}
              onStart={startServer}
              onStop={stopServer}
              onBack={() => setActiveServer(null)}
            />

            {/* Comandos rápidos */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Comandos Rápidos
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => sendCommand(activeServer, "time set day")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Día
                </button>
                <button
                  onClick={() => sendCommand(activeServer, "time set night")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  Noche
                </button>
                <button
                  onClick={() => sendCommand(activeServer, "weather clear")}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  Clima despejado
                </button>
                <button
                  onClick={() => sendCommand(activeServer, "weather rain")}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                >
                  Lluvia
                </button>
                <button
                  onClick={() => sendCommand(activeServer, "weather thunder")}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg"
                >
                  Tormenta
                </button>
                <button
                  onClick={() => sendCommand(activeServer, "op akalex07")}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg"
                >
                  OP
                </button>
              </div>
            </div>
          </div>

          {/* Columna derecha: jugadores conectados */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Jugadores conectados ({servers[activeServer]?.players?.online ?? 0})
              </h3>
              <div className="flex flex-col gap-3">
                {servers[activeServer]?.players?.sample?.length > 0 ? (
                  servers[activeServer].players.sample.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <img
                        src={`https://crafatar.com/avatars/${p.id}?overlay`}
                        alt={p.name}
                        className="w-8 h-8 rounded"
                      />
                      <span className="text-gray-800 dark:text-gray-200">
                        {p.name}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">
                    No hay jugadores conectados
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              Panel de Servidores Minecraft
            </h1>

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
                compact={viewMode === "list"}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
