import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Maximize2, Minimize2 } from "lucide-react";

export default function ServerCard({ server, data, onStart, onStop, onOpen }) {
  const [logs, setLogs] = useState("");
  const [command, setCommand] = useState("");
  const [expanded, setExpanded] = useState(false);
  const preRef = useRef();

  const socket = useRef(null);

  useEffect(() => {
    socket.current = io("http://localhost:4000", { withCredentials: true });

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
      className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 transition-all ${expanded ? "col-span-full" : "hover:shadow-lg"
        }`

      }
      onClick={() => onOpen(server)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {data.icon ? (
            <img
              src={`http://localhost:4000/api/server-icon/${server}`}
              alt={`${server} icon`}
              className="w-12 h-12 rounded-md object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500">
              🎮
            </div>
          )}
          <h3 className="text-xl font-semibold text-purple-600 dark:text-purple-400">
            {server}
          </h3>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded)
          }}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* Información principal (siempre igual) */}
      <div className="space-y-2">
        <p className="text-gray-700 dark:text-gray-300">
          Estado:{" "}
          <span
            className={
              data.running
                ? "text-green-600 font-semibold"
                : "text-red-600 font-semibold"
            }
          >
            {data.running ? "Activo" : "Detenido"}
          </span>{" "}
          {data.pid && `(PID: ${data.pid})`}
        </p>

        <p
          className={`${data.ping?.up
              ? "text-green-600 dark:text-green-400"
              : "text-red-500 dark:text-red-400"
            } font-medium`}
        >
          Ping: {data.ping?.up ? `UP — players: ${data.ping.players}` : "DOWN"}
        </p>

        <p className="text-gray-700 dark:text-gray-300">
          Versión: {data.version || "N/A"}
        </p>


      </div>

      {/* Detalles solo si expandido */}
      {expanded && (

        <div className="mt-4 space-y-4">
          <div className="flex gap-2 mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStart(server);
              }}
              disabled={data.running}
              className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors ${data.running
                  ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
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
              className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors ${!data.running
                  ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                }`}
            >
              Stop
            </button>
          </div>
          <div>
            <p className="font-medium mb-2">Logs:</p>
            <pre
              ref={preRef}
              className="bg-gray-100 dark:bg-gray-900 p-2 rounded-md h-40 overflow-y-auto text-xs"
            >
              {logs || "Sin logs aún..."}
            </pre>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Escribe un comando..."
              className="flex-1 px-3 py-2 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={sendCommand}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
