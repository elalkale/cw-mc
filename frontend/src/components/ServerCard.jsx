import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Maximize2, Minimize2 } from "lucide-react";

export default function ServerCard({ server, data, onStart, onStop, darkMode }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState("");
  const [command, setCommand] = useState("");
  const [expanded, setExpanded] = useState(false);
  const preRef = useRef();

  const socket = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    socket.current = io("http://localhost:4000", {
      auth: { token }
    });

    socket.current.emit("join", server);

    socket.current.on("log", ({ server: srv, line }) => {
      if (srv === server) setLogs((prev) => prev + line);
    });

    socket.current.on("log_history", ({ server: srv, logs }) => {
      if (srv === server) setLogs(logs || "");
    });

    return () => {
      socket.current.disconnect();
    };
  }, [server]);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [logs]);

  const sendCommand = () => {
    if (command && socket.current) {
      socket.current.emit("command", { server, command });
      setCommand("");
    }
  };

  return (
    <div
      className={`p-5 rounded-2xl shadow-lg border transition-all cursor-pointer overflow-hidden hover:shadow-2xl ${
        darkMode
          ? "bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20 hover:border-purple-500/40"
          : "bg-gradient-to-br from-gray-100 to-gray-200 border-purple-400/50 hover:border-purple-500/70"
      } ${expanded ? "col-span-full" : ""}`}
      onClick={() => navigate(`/dashboard/${encodeURIComponent(server)}`)}
    >
      {/* Status Badge */}
      <div className="absolute top-4 right-4 z-10">
        <div
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            data.running
              ? "bg-green-500/20 text-green-600 border border-green-500/50 dark:text-green-300"
              : "bg-red-500/20 text-red-600 border border-red-500/50 dark:text-red-300"
          }`}
        >
          {data.running ? "● Activo" : "● Detenido"}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {data.icon ? (
            <img
              src={`http://localhost:4000/api/server-icon/${encodeURIComponent(server)}`}
              alt={`${server} icon`}
              onError={(e) => console.error('Error cargando icono:', e.target.src)}
              className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover flex-shrink-0 border-2 border-purple-500/30 shadow-lg"
            />
          ) : (
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white flex-shrink-0 text-xl shadow-lg">
              🎮
            </div>
          )}
          <h3 className={`text-base md:text-xl font-bold bg-clip-text text-transparent truncate ${
            darkMode ? "bg-gradient-to-r from-purple-300 to-pink-300" : "bg-gradient-to-r from-purple-700 to-pink-700"
          }`}>
            {server}
          </h3>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className={`p-2 rounded-md transition-colors ${
            darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
          }`}
        >
          {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* Información principal (siempre igual) */}
      <div className="space-y-3 text-sm md:text-base">
        {/* Ping Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              data.ping?.up ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          ></div>
          <span className={darkMode ? "text-gray-300" : "text-gray-700"}>
            {data.ping?.up ? "Conectado" : "Desconectado"}
          </span>
        </div>

        {/* Players Info */}
        {data.ping?.up && (
          <div className={`flex items-center justify-between py-2 px-3 rounded-lg border ${
            darkMode
              ? "bg-gray-700/30 border-purple-500/20"
              : "bg-purple-200/30 border-purple-400/50"
          }`}>
            <span className={darkMode ? "text-gray-400" : "text-gray-700"}>
              Jugadores
            </span>
            <span className={`font-semibold ${darkMode ? "text-purple-300" : "text-purple-700"}`}>
              {data.players?.online ?? 0}/{data.players?.max ?? 20}
            </span>
          </div>
        )}

        {/* Version */}
        <p className={`text-xs ${
          darkMode ? "text-gray-400" : "text-gray-700"
        }`}>
          Versión: <span className={`font-semibold ${darkMode ? "text-purple-300" : "text-purple-700"}`}>{data.version || "N/A"}</span>
        </p>
      </div>

      {/* Detalles solo si expandido */}
      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStart(server);
              }}
              disabled={data.running}
              className={`flex-1 py-2 text-sm md:text-base rounded-lg font-medium text-white transition-colors ${
                data.running
                  ? darkMode
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gray-300 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              Start
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onStop(server);
              }}
              disabled={!data.running}
              className={`flex-1 py-2 text-sm md:text-base rounded-lg font-medium text-white transition-colors ${
                !data.running
                  ? darkMode
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gray-300 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              Stop
            </button>
          </div>
          <div>
            <p className="text-sm md:text-base font-medium mb-2">Logs:</p>
            <pre
              ref={preRef}
              className={`p-2 rounded-md h-32 sm:h-40 md:h-48 overflow-y-auto text-xs ${
                darkMode
                  ? "bg-gray-900 text-gray-300"
                  : "bg-gray-50 text-gray-800"
              }`}
            >
              {logs || "Sin logs aún..."}
            </pre>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Escribe un comando..."
              className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                darkMode
                  ? "border-gray-700 bg-gray-700 text-white placeholder-gray-400"
                  : "border-gray-400 bg-white text-gray-900 placeholder-gray-700"
              }`}
            />
            <button
              onClick={sendCommand}
              className="px-3 md:px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
