import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Play, Square, PowerOff, HardDrive, Download,
  Activity, Wifi, Tag, Terminal, Send, Copy, Trash2, X, FolderOpen,
  Package, Search, RefreshCw, Upload, HelpCircle, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api';
import FileExplorer from './FileExplorer';
import ModCatalog from './ModCatalog';
import ServerConfig from './ServerConfig';
import { Settings2 } from 'lucide-react';

const LOADER_NAMES  = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };
const LOADER_COLORS = { 1: 'bg-orange-500/15 text-orange-300 border-orange-500/25', 4: 'bg-blue-500/15 text-blue-300 border-blue-500/25', 5: 'bg-purple-500/15 text-purple-300 border-purple-500/25', 6: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' };

export default function ServerDetail({ server, data, onStart, onStop, onForceStop, onDelete, darkMode }) {
  const [logs, setLogs] = useState('');
  const [tab, setTab] = useState('consola');
  const [command, setCommand] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isCreatingLocal, setIsCreatingLocal] = useState(false);

  // ── Clone ────────────────────────────────────────────────────────────────
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState('');

  // ── Notificación (reemplaza alert()) ─────────────────────────────────────
  const [notification, setNotification] = useState(null); // { type:'success'|'error', title, message }
  const notify = (type, title, message) => setNotification({ type, title, message });

  // ── Delete ───────────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── File explorer ────────────────────────────────────────────────────────
  const [showFiles, setShowFiles] = useState(false);

  // ── Mods ─────────────────────────────────────────────────────────────────
  const [mods, setMods] = useState([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [togglingMod, setTogglingMod] = useState(null);
  const [deletingMod, setDeletingMod] = useState(null);
  const [modToDelete, setModToDelete] = useState(null);
  const [modSearch, setModSearch] = useState('');
  const [uploadingMods, setUploadingMods] = useState(false);
  const [showModCatalog, setShowModCatalog] = useState(false);
  const [identifyingMods, setIdentifyingMods] = useState(false);
  const modUploadRef = useRef(null);

  const preRef = useRef<HTMLPreElement>(null);
  const socket = useRef(null);
  const logsId = `detail-logs-${server.replace(/\s+/g, '-')}`;

  useEffect(() => {
    socket.current = io(API_BASE, { auth: { token: localStorage.getItem('authToken') } });
    socket.current.emit('join', server);
    socket.current.on('log', ({ server: srv, line }) => {
      if (srv === server) setLogs(prev => prev + line);
    });
    socket.current.on('log_history', ({ server: srv, logs }) => {
      if (srv === server) setLogs(logs || '');
    });
    return () => socket.current.disconnect();
  }, [server]);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (tab === 'consola' && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [tab]);

  const sendCommand = () => {
    if (command && socket.current) {
      socket.current.emit('command', { server, command });
      setCommand('');
    }
  };

  const downloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetchWithToken(`${API_BASE}/api/backup/${encodeURIComponent(server)}`);
      if (!res.ok) {
        let errStr = 'Error al descargar el backup';
        try { errStr = (await res.json()).error || errStr; } catch { }
        throw new Error(errStr);
      }
      const dateStr = new Date().toISOString().replace(/\..+/, '').replace(/:/g, '-');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${server}_backup_${dateStr}.zip`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (err) {
      console.error('Error backup:', err);
      notify('error', 'Error al descargar backup', err.message);
    } finally { setIsBackingUp(false); }
  };

  const handleClone = async () => {
    if (!cloneName.trim()) { setCloneError('El nombre no puede estar vacío'); return; }
    setCloning(true);
    setCloneError('');
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/servers/${encodeURIComponent(server)}/clone`,
        { method: 'POST', body: JSON.stringify({ newName: cloneName.trim() }) }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al clonar el servidor');
      setShowCloneModal(false);
      setCloneName('');
    } catch (err) {
      setCloneError(err.message);
    } finally {
      setCloning(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/servers/${encodeURIComponent(server)}`,
        { method: 'DELETE' }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al eliminar el servidor');
      onDelete?.();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  const createLocalBackup = async () => {
    setIsCreatingLocal(true);
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/backup/${encodeURIComponent(server)}/local`,
        { method: 'POST' }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al crear backup local');
      notify('success', 'Backup creado', d.filename);
    } catch (err) {
      console.error('Error backup local:', err);
      notify('error', 'Error al crear backup', err.message);
    } finally { setIsCreatingLocal(false); }
  };

  const identifyMods = async () => {
    setIdentifyingMods(true);
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/servers/${encodeURIComponent(server)}/mods/identify`,
        { method: 'POST' }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      // Recargar la lista con los metadatos ya disponibles
      const r2 = await fetchWithToken(`${API_BASE}/api/servers/${encodeURIComponent(server)}/mods`);
      const d2 = await r2.json();
      setMods(d2.mods || []);
    } catch (err) {
      console.error('Error identificando mods:', err);
    } finally {
      setIdentifyingMods(false);
    }
  };

  const fetchMods = () => {
    setLoadingMods(true);
    fetchWithToken(`${API_BASE}/api/servers/${encodeURIComponent(server)}/mods`)
      .then(r => r.json())
      .then(d => {
        setMods(d.mods || []);
        if (d.needsIdentification) identifyMods();
      })
      .catch(console.error)
      .finally(() => setLoadingMods(false));
  };

  const handleModUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = '';
    setUploadingMods(true);
    try {
      const formData = new FormData();
      (files as File[]).forEach(f => formData.append('mods', f));
      const res = await fetchWithToken(
        `${API_BASE}/api/servers/${encodeURIComponent(server)}/mods/upload`,
        { method: 'POST', body: formData }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al subir mods');
      fetchMods();
    } catch (err) {
      console.error(err);
      notify('error', 'Error al subir mods', err.message);
    } finally {
      setUploadingMods(false);
    }
  };

  useEffect(() => {
    if (tab === 'mods') fetchMods();
  }, [tab]);

  const toggleMod = async (mod) => {
    setTogglingMod(mod.filename);
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/servers/${encodeURIComponent(server)}/mods/toggle`,
        { method: 'POST', body: JSON.stringify({ filename: mod.filename }) }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMods(prev => prev.map(m =>
        m.filename === mod.filename
          ? { ...m, filename: d.newFilename, enabled: !m.enabled }
          : m
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingMod(null);
    }
  };

  const deleteMod = async (mod) => {
    setDeletingMod(mod.filename);
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/servers/${encodeURIComponent(server)}/mods/${encodeURIComponent(mod.filename)}`,
        { method: 'DELETE' }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMods(prev => prev.filter(m => m.filename !== mod.filename));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingMod(null);
    }
  };

  const formatSize = bytes => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const filteredMods = mods.filter(m =>
    m.name.toLowerCase().includes(modSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col space-y-4">

      {/* ── Header con banner ──────────────────────────────────────────────── */}
      <div className={`rounded-2xl overflow-hidden shadow-lg border ${darkMode
        ? 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25'
        : 'bg-gradient-to-br from-white to-purple-50/70 border-purple-300/60'
      }`}>

        {/* Banner */}
        <div className="h-20 sm:h-24 relative overflow-hidden flex-shrink-0 z-0">
          {(data.modpack?.logo || data.icon) && (
            <img
              src={data.modpack?.logo ?? `${API_BASE}/api/server-icon/${encodeURIComponent(server)}`}
              alt="" aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className={`absolute inset-0 ${darkMode
            ? 'bg-gradient-to-br from-purple-900/70 via-indigo-900/50 to-pink-900/60'
            : 'bg-gradient-to-br from-purple-200/80 via-indigo-100 to-pink-200/80'
          }`} />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />

          {/* Badge estado */}
          <div className="absolute top-3 right-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border ${
              data.running
                ? 'bg-green-500/20 border-green-400/40 text-green-300'
                : 'bg-gray-700/70 border-gray-500/40 text-gray-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${data.running ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              {data.running ? 'Activo' : 'Detenido'}
            </div>
          </div>
        </div>

        {/* Icono + Info */}
        <div className="px-5 pb-4 -mt-4 sm:-mt-5 flex flex-row gap-4 items-start relative z-10">
          <div className="flex-shrink-0">
            {data.icon ? (
              <img
                src={`${API_BASE}/api/server-icon/${encodeURIComponent(server)}`}
                alt={`Icono ${server}`}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-4 shadow-xl ${darkMode ? 'border-gray-900' : 'border-white'}`}
              />
            ) : (
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-xl border-4 ${darkMode ? 'border-gray-900' : 'border-white'}`} aria-hidden="true">
                🎮
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-5 sm:pt-6">
            <h2 className={`text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${darkMode ? 'from-purple-300 via-pink-300 to-purple-200' : 'from-purple-700 via-pink-600 to-purple-600'}`}>
              {server}
            </h2>
            {data.modpack ? (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {data.modpack.logo && (
                  <img src={data.modpack.logo} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" />
                )}
                <a
                  href={`https://www.curseforge.com/minecraft/modpacks/${data.modpack.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium truncate max-w-[140px]"
                >
                  {data.modpack.name}
                </a>
                {data.modpack.modLoaders?.slice(0, 1).map(l => LOADER_NAMES[l] && (
                  <span key={l} className={`text-xs px-1.5 py-px rounded-full border font-medium ${LOADER_COLORS[l] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                    {LOADER_NAMES[l]}
                  </span>
                ))}
                {data.modpack.gameVersions?.slice(0, 1).map(v => (
                  <span key={v} className="text-xs px-1.5 py-px rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                    {v}
                  </span>
                ))}
              </div>
            ) : (
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Panel de control del servidor</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Botones de control (siempre visibles) ───────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onStart(server)} disabled={data.running}
          aria-label={`Iniciar servidor ${server}`}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${data.running
            ? darkMode ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border border-gray-700/30' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-900/30 hover:scale-[1.02] active:scale-95'
          }`}
        >
          <Play size={15} aria-hidden="true" /> Iniciar
        </button>

        <button
          onClick={() => onStop(server)} disabled={!data.running}
          aria-label={`Detener servidor ${server}`}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${!data.running
            ? darkMode ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border border-gray-700/30' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-900/30 hover:scale-[1.02] active:scale-95'
          }`}
        >
          <Square size={15} aria-hidden="true" /> Detener
        </button>

        <button
          onClick={() => onForceStop(server)} disabled={!data.running}
          aria-label={`Forzar parada del servidor ${server}`}
          title="Mata el proceso inmediatamente sin esperar al guardado"
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border-2 transition-all ${!data.running
            ? darkMode ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border-gray-700/30' : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
            : darkMode
              ? 'border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-400 hover:scale-[1.02] active:scale-95'
              : 'border-red-400/60 text-red-600 hover:bg-red-50 hover:border-red-500 hover:scale-[1.02] active:scale-95'
          }`}
        >
          <PowerOff size={15} aria-hidden="true" /> Forzar
        </button>
      </div>

      {/* ── Stats (siempre visibles) ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl p-4 border shadow-sm ${darkMode
          ? (data.running ? 'bg-gradient-to-br from-gray-800/90 to-green-950/30 border-green-500/20' : 'bg-gradient-to-br from-gray-800/90 to-red-950/20 border-red-500/20')
          : (data.running ? 'bg-gradient-to-br from-white to-green-50 border-green-200/80' : 'bg-gradient-to-br from-white to-red-50 border-red-200/80')
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${data.running ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            <Activity size={16} className={data.running ? 'text-green-400' : 'text-red-400'} />
          </div>
          <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Estado</p>
          <p className={`text-sm font-bold ${data.running
            ? (darkMode ? 'text-green-400' : 'text-green-600')
            : (darkMode ? 'text-red-400' : 'text-red-600')
          }`}>
            {data.running ? 'Activo' : 'Detenido'}
          </p>
          {data.pid && <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>PID {data.pid}</p>}
        </div>

        <div className={`rounded-2xl p-4 border shadow-sm ${darkMode
          ? (data.ping?.up ? 'bg-gradient-to-br from-gray-800/90 to-blue-950/30 border-blue-500/20' : 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/20')
          : (data.ping?.up ? 'bg-gradient-to-br from-white to-blue-50 border-blue-200/80' : 'bg-gradient-to-br from-white to-purple-50/60 border-purple-200/70')
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${data.ping?.up ? 'bg-blue-500/20' : 'bg-gray-500/15'}`}>
            <Wifi size={16} className={data.ping?.up ? 'text-blue-400' : (darkMode ? 'text-gray-500' : 'text-gray-400')} />
          </div>
          <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Conexión</p>
          <p className={`text-sm font-bold ${data.ping?.up
            ? (darkMode ? 'text-blue-400' : 'text-blue-600')
            : (darkMode ? 'text-gray-500' : 'text-gray-500')
          }`}>
            {data.ping?.up ? 'Online' : 'Offline'}
          </p>
          {data.ping?.up && (
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-blue-600/80' : 'text-blue-400'}`}>
              {data.players?.online ?? 0}/{data.players?.max ?? 0} jugadores
            </p>
          )}
        </div>

        <div className={`rounded-2xl p-4 border shadow-sm ${darkMode
          ? 'bg-gradient-to-br from-gray-800/90 to-purple-950/30 border-purple-500/25'
          : 'bg-gradient-to-br from-white to-purple-50 border-purple-200/80'
        }`}>
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
            <Tag size={16} className="text-purple-400" />
          </div>
          <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Versión</p>
          <p className={`text-sm font-bold ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
            {data.modpack?.gameVersions?.[0] || data.version || 'N/A'}
          </p>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div
        className={`flex gap-1 p-1 rounded-2xl border ${darkMode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-white border-gray-200 shadow-sm'}`}
        role="tablist"
      >
        {[
          { id: 'consola',       label: 'Consola' },
          { id: 'mods',          label: 'Mods' },
          { id: 'gestion',       label: 'Gestión' },
          { id: 'configuracion', label: 'Configuración' },
        ].map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${tab === t.id
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
              : darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Consola ──────────────────────────────────────────────────────────── */}
      {tab === 'consola' && (
        <div className={`rounded-2xl overflow-hidden shadow-lg border ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
          <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${darkMode ? 'bg-gray-800 border-gray-700/60' : 'bg-gray-100 border-gray-200'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 shrink-0" />
            <div className={`flex items-center gap-1.5 ml-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Terminal size={12} />
              <span className="text-xs font-medium font-mono">{server} — logs</span>
            </div>
          </div>

          <pre
            id={logsId}
            ref={preRef}
            aria-live="polite"
            aria-atomic="false"
            className="h-56 md:h-80 overflow-y-scroll px-4 py-3 font-mono text-xs leading-relaxed bg-gray-950 text-green-400 custom-scrollbar"
          >
            {logs || '// Esperando logs...'}
          </pre>

          <div className={`flex items-center gap-2.5 px-4 py-2.5 border-t ${darkMode ? 'bg-gray-900 border-gray-700/60' : 'bg-gray-50 border-gray-200'}`}>
            <span className="text-green-500 font-mono text-sm shrink-0 select-none">$</span>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
              placeholder="escribe un comando..."
              disabled={!data.running}
              aria-label={`Comando para el servidor ${server}`}
              className={`flex-1 bg-transparent font-mono text-sm focus:outline-none disabled:opacity-40 ${darkMode
                ? 'text-green-400 placeholder-green-900/80'
                : 'text-green-800 placeholder-green-700/30'
              }`}
            />
            <button
              onClick={sendCommand}
              disabled={!data.running}
              aria-label="Enviar comando"
              className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              <Send size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ── Mods ─────────────────────────────────────────────────────────────── */}
      {tab === 'mods' && (
        <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${darkMode
          ? 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25'
          : 'bg-gradient-to-br from-white to-purple-50/70 border-purple-300/60 shadow-sm'
        }`}>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-50'}`}>
                <Package size={14} className="text-purple-400" />
              </div>
              <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Gestor de mods</span>
              {mods.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                  {mods.filter(m => m.enabled).length}/{mods.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 ">
              <input
                ref={modUploadRef}
                type="file"
                accept=".jar"
                multiple
                className="hidden"
                onChange={handleModUpload}
              />
              {/* Botón catálogo */}
              <button
                onClick={() => setShowModCatalog(true)}
                aria-label="Buscar mod en catálogo"
                title="Buscar mod en catálogo"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${darkMode
                  ? 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-purple-200'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-700'
                }`}
              >
                <Package size={12} aria-hidden="true" />
                Catálogo
              </button>
              {/* Botón subir .jar */}
              <button
                onClick={() => modUploadRef.current?.click()}
                disabled={uploadingMods}
                aria-label="Subir mod .jar"
                title="Subir mod (.jar)"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${darkMode
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
              >
                {uploadingMods
                  ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-current animate-spin" />
                  : <Upload size={12} aria-hidden="true" />}
                Subir
              </button>
              {/* Recargar */}
              <button
                onClick={fetchMods}
                disabled={loadingMods}
                aria-label="Recargar mods"
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
              >
                <RefreshCw size={13} className={loadingMods ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={modSearch}
              onChange={e => setModSearch(e.target.value)}
              placeholder="Buscar mod..."
              className={`w-full pl-8 pr-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode
                ? 'bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
                : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
              }`}
            />
          </div>

          {/* Banner identificando */}
          {identifyingMods && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${darkMode
              ? 'bg-purple-500/10 border border-purple-500/20 text-purple-300'
              : 'bg-purple-50 border border-purple-200 text-purple-600'
            }`}>
              <RefreshCw size={11} className="animate-spin flex-shrink-0" />
              Identificando mods con CurseForge…
            </div>
          )}

          {/* Lista */}
          {loadingMods ? (
            <div className="flex flex-col gap-1.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`h-14 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
              ))}
            </div>
          ) : filteredMods.length === 0 ? (
            <div className={`flex flex-col items-center justify-center gap-2 py-10 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              <Package size={28} className="opacity-30" />
              <p className="text-xs text-center">
                {mods.length === 0 ? 'No se encontraron mods' : 'Sin resultados para la búsqueda'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 min-h-[8rem] max-h-[calc(100vh-540px)] overflow-y-auto custom-scrollbar pr-1">
              {filteredMods.map(mod => (
                <div
                  key={mod.filename}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all ${darkMode
                    ? 'border-gray-700/40 hover:border-gray-600/60 hover:bg-gray-700/20'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  } ${!mod.enabled ? 'opacity-55' : ''}`}
                >
                  {/* Logo / icono */}
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden ${
                    mod.logo
                      ? ''
                      : mod.recognized === false
                        ? darkMode ? 'bg-gray-700/70' : 'bg-gray-100'
                        : darkMode ? 'bg-purple-500/15' : 'bg-purple-50'
                  }`}>
                    {mod.logo ? (
                      <img
                        src={mod.logo}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : mod.recognized === false ? (
                      <HelpCircle size={15} className={darkMode ? 'text-gray-500' : 'text-gray-400'} />
                    ) : (
                      <Package size={15} className="text-purple-400 opacity-70" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      {mod.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <span className={`text-xs flex-shrink-0 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{formatSize(mod.size)}</span>
                      {mod.recognized === true && (
                        <span className={`text-[10px] font-mono truncate ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                          {mod.filename.replace(/\.jar(\.disabled)?$/, '')}
                        </span>
                      )}
                      {mod.recognized === false && (
                        <span className={`text-[10px] flex-shrink-0 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} title="No encontrado en CurseForge">· no reconocido</span>
                      )}
                    </div>
                  </div>

                  {/* Toggle enable/disable */}
                  <button
                    onClick={() => toggleMod(mod)}
                    disabled={togglingMod !== null || deletingMod !== null}
                    aria-label={mod.enabled ? `Desactivar ${mod.name}` : `Activar ${mod.name}`}
                    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 disabled:cursor-wait ${
                      mod.enabled
                        ? 'bg-green-500 hover:bg-green-400'
                        : darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${mod.enabled ? 'left-6' : 'left-1'} ${togglingMod === mod.filename ? 'opacity-60' : ''}`} />
                  </button>

                  {/* Borrar mod */}
                  <button
                    onClick={() => setModToDelete(mod)}
                    disabled={togglingMod !== null || deletingMod !== null}
                    aria-label={`Eliminar ${mod.name}`}
                    className={`flex-shrink-0 p-1.5 rounded-lg transition-colors disabled:cursor-wait ${
                      deletingMod === mod.filename
                        ? 'opacity-50 cursor-wait'
                        : darkMode
                          ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10'
                          : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    {deletingMod === mod.filename
                      ? <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-current animate-spin block" />
                      : <Trash2 size={14} />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Gestión ──────────────────────────────────────────────────────────── */}
      {tab === 'gestion' && (
        <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${darkMode
          ? 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25'
          : 'bg-gradient-to-br from-white to-purple-50/70 border-purple-300/60 shadow-sm'
        }`}>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={createLocalBackup} disabled={isCreatingLocal}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
                ? 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-400/50'
                : 'border-indigo-400/40 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-500/60'
              } ${isCreatingLocal ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            >
              {isCreatingLocal
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-current animate-spin" />
                : <HardDrive size={14} aria-hidden="true" />}
              {isCreatingLocal ? 'Creando...' : 'Backup Local'}
            </button>

            <button
              onClick={downloadBackup} disabled={isBackingUp}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
                ? 'border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:border-blue-400/50'
                : 'border-blue-400/40 text-blue-700 hover:bg-blue-50 hover:border-blue-500/60'
              } ${isBackingUp ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            >
              {isBackingUp
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-current animate-spin" />
                : <Download size={14} aria-hidden="true" />}
              {isBackingUp ? 'Descargando...' : 'Descargar ZIP'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setCloneName(`${server}-copia`); setCloneError(''); setShowCloneModal(true); }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
                ? 'border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-400/50'
                : 'border-indigo-400/40 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-500/60'
              }`}
            >
              <Copy size={14} aria-hidden="true" /> Clonar
            </button>
            <button
              onClick={() => { setDeleteError(''); setShowDeleteConfirm(true); }}
              disabled={data.running}
              title={data.running ? 'Detén el servidor antes de eliminarlo' : ''}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm border transition-all hover:scale-[1.02] active:scale-95 ${data.running
                ? darkMode ? 'border-gray-700/30 text-gray-500 cursor-not-allowed' : 'border-gray-200 text-gray-400 cursor-not-allowed'
                : darkMode
                  ? 'border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-400/50'
                  : 'border-red-400/40 text-red-600 hover:bg-red-50 hover:border-red-500/60'
              }`}
            >
              <Trash2 size={14} aria-hidden="true" /> Eliminar
            </button>
          </div>

          <button
            onClick={() => setShowFiles(true)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
              ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50'
              : 'border-purple-400/40 text-purple-700 hover:bg-purple-50 hover:border-purple-500/60'
            }`}
          >
            <FolderOpen size={14} aria-hidden="true" /> Explorador de archivos
          </button>
        </div>
      )}
      {/* ── Modal Catálogo de Mods ───────────────────────────────────────── */}
      {showModCatalog && (
        <ModCatalog
          server={server}
          data={data}
          darkMode={darkMode}
          onClose={() => setShowModCatalog(false)}
          onModInstalled={fetchMods}
          installedModIds={new Set(mods.filter(m => m.modId).map(m => m.modId))}
        />
      )}

      {/* ── Modal Explorador de archivos ─────────────────────────────────── */}
      {showFiles && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowFiles(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4 md:p-8">
            <div
              className={`w-full max-w-4xl rounded-2xl shadow-2xl border pointer-events-auto flex flex-col ${darkMode
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30'
                : 'bg-white border-purple-200/70'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
                    <FolderOpen size={14} className="text-purple-400" />
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Explorador de archivos — {server}
                  </h3>
                </div>
                <button
                  onClick={() => setShowFiles(false)}
                  className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                  aria-label="Cerrar explorador"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="h-[500px] p-4">
                <FileExplorer serverName={server} darkMode={darkMode} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Configuración ────────────────────────────────────────────────── */}
      {tab === 'configuracion' && (
        <ServerConfig
          server={server}
          serverVersion={data.version || ''}
          darkMode={darkMode}
        />
      )}

      {/* ── Modal Clonar ─────────────────────────────────────────────────── */}
      {showCloneModal && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => !cloning && setShowCloneModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
            <div
              className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-indigo-500/30'
                : 'bg-white border-indigo-200/70'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-indigo-500/15' : 'bg-indigo-100'}`}>
                    <Copy size={14} className="text-indigo-400" />
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Clonar servidor</h3>
                </div>
                <button onClick={() => !cloning && setShowCloneModal(false)} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={15} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Nombre del servidor clonado
                </label>
                <input
                  type="text"
                  value={cloneName}
                  onChange={e => setCloneName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleClone()}
                  disabled={cloning}
                  className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode
                    ? 'bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-indigo-500/60'
                    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-indigo-400'
                  } disabled:opacity-50`}
                />
                {cloneError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{cloneError}</p>
                )}
              </div>
              <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button
                  onClick={() => setShowCloneModal(false)} disabled={cloning}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} disabled:opacity-50`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClone} disabled={cloning}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60"
                >
                  {cloning ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />Clonando...</> : <><Copy size={14} />Clonar</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modal Eliminar ────────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => !deleting && setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
            <div
              className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-red-500/30'
                : 'bg-white border-red-200/70'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-red-500/15' : 'bg-red-100'}`}>
                    <Trash2 size={14} className="text-red-400" />
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Eliminar servidor</h3>
                </div>
                <button onClick={() => !deleting && setShowDeleteConfirm(false)} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={15} />
                </button>
              </div>
              <div className="px-5 py-4">
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  ¿Seguro que quieres eliminar <span className="font-semibold text-red-400">{server}</span>?
                </p>
                <p className={`text-xs mt-1.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Esta acción eliminará todos los archivos del servidor permanentemente.
                </p>
                {deleteError && (
                  <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{deleteError}</p>
                )}
              </div>
              <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button
                  onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} disabled:opacity-50`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete} disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-60"
                >
                  {deleting ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />Eliminando...</> : <><Trash2 size={14} />Eliminar</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modal Eliminar Mod ───────────────────────────────────────────────── */}
      {modToDelete && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => !deletingMod && setModToDelete(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
            <div
              className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-red-500/30'
                : 'bg-white border-red-200/70'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-red-500/15' : 'bg-red-100'}`}>
                    <Trash2 size={14} className="text-red-400" />
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Eliminar mod</h3>
                </div>
                <button onClick={() => !deletingMod && setModToDelete(null)} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={15} />
                </button>
              </div>
              <div className="px-5 py-4">
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  ¿Eliminar <span className="font-semibold text-red-400">{modToDelete.name}</span>?
                </p>
                <p className={`text-xs mt-1.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  El archivo <span className="font-mono">{modToDelete.filename}</span> se borrará permanentemente.
                </p>
              </div>
              <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button
                  onClick={() => setModToDelete(null)} disabled={!!deletingMod}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} disabled:opacity-50`}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteMod(modToDelete).then(() => setModToDelete(null))}
                  disabled={!!deletingMod}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-60"
                >
                  {deletingMod ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />Eliminando...</> : <><Trash2 size={14} />Eliminar</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {/* ── Modal Notificación ──────────────────────────────────────────────── */}
      {notification && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={() => setNotification(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none px-4">
            <div
              className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode
                ? `bg-gradient-to-br from-gray-800 to-gray-900 ${notification.type === 'error' ? 'border-red-500/30' : 'border-green-500/30'}`
                : `bg-white ${notification.type === 'error' ? 'border-red-200/70' : 'border-green-200/70'}`
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    notification.type === 'error'
                      ? darkMode ? 'bg-red-500/15' : 'bg-red-100'
                      : darkMode ? 'bg-green-500/15' : 'bg-green-100'
                  }`}>
                    {notification.type === 'error'
                      ? <AlertCircle size={14} className="text-red-400" />
                      : <CheckCircle2 size={14} className="text-green-400" />
                    }
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{notification.title}</h3>
                </div>
                <button onClick={() => setNotification(null)} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={15} />
                </button>
              </div>
              <div className="px-5 py-4">
                <p className={`text-sm font-mono break-all ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{notification.message}</p>
              </div>
              <div className={`flex justify-end px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button
                  onClick={() => setNotification(null)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
