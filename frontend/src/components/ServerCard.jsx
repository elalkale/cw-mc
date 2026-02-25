import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Maximize2, Minimize2, Play, Square, Users, Terminal, Send } from "lucide-react";
import { API_BASE } from "../lib/api.js";

export default function ServerCard({ server, data, onStart, onStop, darkMode }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState("");
  const [command, setCommand] = useState("");
  const [expanded, setExpanded] = useState(false);
  const preRef = useRef();
  const socket = useRef(null);

  const logsId = `logs-${server.replace(/\s+/g, '-')}`;
  const cmdInputId = `cmd-${server.replace(/\s+/g, '-')}`;

  useEffect(() => {
    socket.current = io(API_BASE, { auth: { token: localStorage.getItem('authToken') } });
    socket.current.emit("join", server);
    socket.current.on("log", ({ server: srv, line }) => {
      if (srv === server) setLogs(prev => prev + line);
    });
    socket.current.on("log_history", ({ server: srv, logs }) => {
      if (srv === server) setLogs(logs || "");
    });
    return () => socket.current.disconnect();
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

  const cardBg = darkMode
    ? "bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20 hover:border-purple-400/50"
    : "bg-gradient-to-br from-white to-gray-50 border-purple-400/40 hover:border-purple-500/60";

  return (
    <div
      className={`rounded-2xl border cursor-pointer transition-all flex flex-col shadow-lg hover:shadow-2xl hover:-translate-y-0.5 ${cardBg} ${expanded ? "col-span-full" : ""}`}
      onClick={() => navigate(`/dashboard/${encodeURIComponent(server)}`)}
      role="article"
      aria-label={`Servidor ${server} – ${data.running ? "activo" : "detenido"}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/dashboard/${encodeURIComponent(server)}`);
        }
      }}
    >
      {/* ── Banner ── */}
      <div className="h-[72px] relative overflow-hidden rounded-t-2xl flex-shrink-0">
        {data.icon ? (
          <img
            src={`${API_BASE}/api/server-icon/${encodeURIComponent(server)}`}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className={`w-full h-full ${
            darkMode
              ? "bg-gradient-to-br from-purple-900/50 via-gray-800 to-pink-900/40"
              : "bg-gradient-to-br from-purple-100 via-white to-pink-100"
          }`} />
        )}
        {/* Fade bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />

        {/* Icono — dentro del banner, abajo-izquierda */}
        <div className="absolute bottom-2.5 left-3">
          {data.icon ? (
            <img
              src={`${API_BASE}/api/server-icon/${encodeURIComponent(server)}`}
              alt={`Icono del servidor ${server}`}
              onError={(e) => { e.target.style.display = 'none'; }}
              className="w-9 h-9 rounded-lg object-cover border border-white/20 shadow-md"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-base shadow-md border border-white/10"
              aria-hidden="true"
            >
              🎮
            </div>
          )}
        </div>

        {/* Status badge */}
        <div className="absolute top-2.5 right-2.5" aria-hidden="true">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border ${
            data.running
              ? "bg-green-500/20 border-green-400/40 text-green-300"
              : "bg-gray-700/70 border-gray-500/40 text-gray-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${data.running ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
            {data.running ? "Activo" : "Detenido"}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pb-4 pt-3 flex flex-col flex-1 gap-3">

        {/* Name row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`font-bold text-base leading-tight truncate ${darkMode ? "text-white" : "text-gray-900"}`}>
              {server}
            </h3>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            className={`shrink-0 mt-1 p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700 text-gray-500 hover:text-gray-300" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"}`}
            aria-label={expanded ? `Contraer tarjeta del servidor ${server}` : `Expandir tarjeta del servidor ${server}`}
            aria-expanded={expanded}
            aria-controls={`card-details-${server.replace(/\s+/g, '-')}`}
          >
            {expanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${data.ping?.up ? "bg-green-400 animate-pulse" : "bg-gray-500"}`}
              aria-hidden="true"
            />
            <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {data.ping?.up ? "Online" : "Offline"}
            </span>
          </div>

          {data.ping?.up && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border ${darkMode
              ? "bg-purple-500/10 border-purple-500/20 text-purple-300"
              : "bg-purple-50 border-purple-200 text-purple-700"
            }`}>
              <Users size={11} aria-hidden="true" />
              <span className="text-xs font-semibold">
                {data.players?.online ?? 0}/{data.players?.max ?? 20}
              </span>
            </div>
          )}

          {data.version && (
            <span className={`px-2 py-0.5 rounded-lg text-xs border ${darkMode
              ? "bg-gray-700/50 text-gray-400 border-gray-600/50"
              : "bg-gray-100 text-gray-500 border-gray-200"
            }`}>
              {data.version}
            </span>
          )}
        </div>

        {/* ── Expanded ── */}
        {expanded && (
          <div
            id={`card-details-${server.replace(/\s+/g, '-')}`}
            className={`space-y-3 border-t pt-3 ${darkMode ? "border-gray-700/50" : "border-gray-200"}`}
          >
            {/* Start / Stop */}
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onStart(server); }}
                disabled={data.running}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm rounded-xl font-medium transition-all ${
                  data.running
                    ? darkMode
                      ? "bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-700/50"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-green-600 hover:bg-green-500 text-white shadow-md shadow-green-900/30"
                }`}
                aria-label={`Iniciar servidor ${server}`}
                aria-disabled={data.running}
              >
                <Play size={13} />
                Iniciar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onStop(server); }}
                disabled={!data.running}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm rounded-xl font-medium transition-all ${
                  !data.running
                    ? darkMode
                      ? "bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-700/50"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/30"
                }`}
                aria-label={`Detener servidor ${server}`}
                aria-disabled={!data.running}
              >
                <Square size={13} />
                Detener
              </button>
            </div>

            {/* Logs */}
            <div>
              <div className={`flex items-center gap-1.5 mb-1.5 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                <Terminal size={11} aria-hidden="true" />
                <p id={`logs-label-${server.replace(/\s+/g, '-')}`} className="text-xs font-medium">Logs</p>
              </div>
              <pre
                ref={preRef}
                id={logsId}
                aria-labelledby={`logs-label-${server.replace(/\s+/g, '-')}`}
                aria-live="polite"
                aria-atomic="false"
                className={`p-3 rounded-xl h-36 overflow-y-auto text-xs font-mono leading-relaxed border custom-scrollbar ${darkMode
                  ? "bg-gray-950 text-gray-400 border-gray-800"
                  : "bg-gray-900 text-gray-300 border-gray-800"
                }`}
              >
                {logs || "Sin logs aún..."}
              </pre>
            </div>

            {/* Command input */}
            <div className="flex gap-2">
              <label htmlFor={cmdInputId} className="sr-only">Comando para el servidor {server}</label>
              <input
                id={cmdInputId}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') sendCommand(); }}
                placeholder="$ comando..."
                className={`flex-1 px-3 py-2 text-xs font-mono rounded-xl border transition-colors focus:outline-none ${darkMode
                  ? "bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60"
                  : "bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400"
                }`}
              />
              <button
                onClick={(e) => { e.stopPropagation(); sendCommand(); }}
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                aria-label={`Enviar comando al servidor ${server}`}
              >
                <Send size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
