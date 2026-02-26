import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Maximize2, Minimize2, Play, Square, Users, Terminal, Send, MoreVertical, Copy, Trash2, X } from "lucide-react";
import { API_BASE, fetchWithToken } from "../lib/api";

export default function ServerCard({ server, data, onStart, onStop, darkMode }) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState("");
  const [command, setCommand] = useState("");
  const [expanded, setExpanded] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const socket = useRef(null);

  // ── Menú 3 puntos ──────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleClone = async () => {
    if (!cloneName.trim()) { setCloneError('El nombre no puede estar vacío'); return; }
    setCloning(true); setCloneError('');
    try {
      const res = await fetchWithToken(`${API_BASE}/api/servers/${encodeURIComponent(server)}/clone`, {
        method: 'POST',
        body: JSON.stringify({ newName: cloneName.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al clonar');
      setShowCloneModal(false);
    } catch (err) {
      setCloneError(err.message);
    } finally {
      setCloning(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true); setDeleteError('');
    try {
      const res = await fetchWithToken(`${API_BASE}/api/servers/${encodeURIComponent(server)}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al eliminar');
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

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
    ? "bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/30 hover:border-purple-400/60"
    : "bg-gradient-to-br from-white to-purple-50/70 border-purple-300/60 hover:border-purple-400/80";

  return (
    <>
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
        {(data.modpack?.logo || data.icon) ? (
          <img
            src={data.modpack?.logo ?? `${API_BASE}/api/server-icon/${encodeURIComponent(server)}`}
            alt=""
            className={`w-full h-full object-cover ${data.modpack?.logo ? 'scale-110 blur-sm opacity-60' : ''}`}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className={`w-full h-full ${
            darkMode
              ? "bg-gradient-to-br from-purple-900/70 via-indigo-900/40 to-pink-900/60"
              : "bg-gradient-to-br from-purple-200/80 via-indigo-100 to-pink-200/80"
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
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
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

          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {/* Expandir / contraer */}
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700 text-gray-500 hover:text-gray-300" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"}`}
              aria-label={expanded ? `Contraer tarjeta del servidor ${server}` : `Expandir tarjeta del servidor ${server}`}
              aria-expanded={expanded}
              aria-controls={`card-details-${server.replace(/\s+/g, '-')}`}
            >
              {expanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
            </button>

            {/* Menú 3 puntos */}
            <div ref={menuRef} className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700 text-gray-500 hover:text-gray-300" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"}`}
                aria-label="Opciones del servidor"
              >
                <MoreVertical size={15} />
              </button>

              {menuOpen && (
                <div className={`absolute right-0 top-full mt-1 w-36 rounded-xl border shadow-xl z-20 overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-700/80' : 'bg-white border-gray-200'}`}>
                  <button
                    onClick={() => { setMenuOpen(false); setCloneName(`${server}-copia`); setCloneError(''); setShowCloneModal(true); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${darkMode ? 'text-gray-300 hover:bg-gray-700/70' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Copy size={14} className="text-indigo-400" />
                    Clonar
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setDeleteError(''); setShowDeleteConfirm(true); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${darkMode ? 'text-red-400 hover:bg-gray-700/70' : 'text-red-600 hover:bg-red-50'}`}
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
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
              ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
              : "bg-purple-100 border-purple-300/70 text-purple-700"
            }`}>
              <Users size={11} aria-hidden="true" />
              <span className="text-xs font-semibold">
                {data.players?.online ?? 0}/{data.players?.max ?? 20}
              </span>
            </div>
          )}

          {(data.modpack?.gameVersions?.[0] || data.version) && (
            <span className={`px-2 py-0.5 rounded-lg text-xs border ${darkMode
              ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
              : "bg-indigo-50 text-indigo-600 border-indigo-200/80"
            }`}>
              {data.modpack?.gameVersions?.[0] || data.version}
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

    {/* ── Modal Clonar ──────────────────────────────────────────────────────── */}
    {showCloneModal && (
      <>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => !cloning && setShowCloneModal(false)} />
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
          <div
            className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-indigo-500/30' : 'bg-white border-indigo-200/70'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-indigo-500/15' : 'bg-indigo-100'}`}>
                  <Copy size={14} className="text-indigo-400" />
                </div>
                <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Clonar servidor</h3>
              </div>
              <button onClick={() => !cloning && setShowCloneModal(false)} disabled={cloning} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X size={15} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Nombre del clon</label>
              <input
                type="text"
                value={cloneName}
                onChange={e => setCloneName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleClone(); }}
                disabled={cloning}
                className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode ? 'bg-gray-900 border-gray-700 text-gray-200 focus:border-indigo-500/60' : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-indigo-400'} disabled:opacity-50`}
              />
              {cloneError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{cloneError}</p>}
            </div>
            <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
              <button onClick={() => setShowCloneModal(false)} disabled={cloning} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} disabled:opacity-50`}>Cancelar</button>
              <button onClick={handleClone} disabled={cloning} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60">
                {cloning ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />Clonando...</> : <><Copy size={13} />Clonar</>}
              </button>
            </div>
          </div>
        </div>
      </>
    )}

    {/* ── Modal Eliminar ────────────────────────────────────────────────────── */}
    {showDeleteConfirm && (
      <>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => !deleting && setShowDeleteConfirm(false)} />
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
          <div
            className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-red-500/30' : 'bg-white border-red-200/70'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-red-500/15' : 'bg-red-100'}`}>
                  <Trash2 size={14} className="text-red-400" />
                </div>
                <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Eliminar servidor</h3>
              </div>
              <button onClick={() => !deleting && setShowDeleteConfirm(false)} disabled={deleting} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X size={15} />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                ¿Eliminar <span className="font-semibold">{server}</span>? Esta acción no se puede deshacer.
              </p>
              {deleteError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">{deleteError}</p>}
            </div>
            <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} disabled:opacity-50`}>Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-60">
                {deleting ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />Eliminando...</> : <><Trash2 size={13} />Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}
