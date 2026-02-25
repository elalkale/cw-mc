import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Play, Square, PowerOff, FileText, HardDrive, Download,
  Activity, Wifi, Tag, Terminal, Send,
} from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api.js';

export default function ServerDetail({ server, data, onStart, onStop, onForceStop, darkMode }) {
  const [logs, setLogs] = useState('');
  const [logsVisible, setLogsVisible] = useState(true);
  const [command, setCommand] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isCreatingLocal, setIsCreatingLocal] = useState(false);

  const preRef = useRef();
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
      alert('Error: ' + err.message);
    } finally { setIsBackingUp(false); }
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
      alert(`Backup creado en la carpeta "backups":\n${d.filename}`);
    } catch (err) {
      console.error('Error backup local:', err);
      alert('Error: ' + err.message);
    } finally { setIsCreatingLocal(false); }
  };

  // ── Tokens ──────────────────────────────────────────────────────────────────
  const panelBg = darkMode
    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
    : 'bg-white border-gray-200';

  return (
    <div className="flex flex-col space-y-4">

      {/* ── Header con banner ──────────────────────────────────────────────── */}
      <div className={`rounded-2xl overflow-hidden shadow-lg border ${darkMode ? 'border-purple-500/20' : 'border-gray-200'}`}>
        <div className="h-20 relative">
          {data.icon ? (
            <img
              src={`${API_BASE}/api/server-icon/${encodeURIComponent(server)}`}
              alt="" className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className={`w-full h-full ${darkMode
              ? 'bg-gradient-to-br from-purple-900/60 via-gray-800 to-pink-900/40'
              : 'bg-gradient-to-br from-purple-100 via-white to-pink-100'
            }`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 to-transparent" />

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

          {/* Icono en banner */}
          <div className="absolute bottom-3 left-4">
            {data.icon ? (
              <img
                src={`${API_BASE}/api/server-icon/${encodeURIComponent(server)}`}
                alt={`Icono ${server}`}
                onError={(e) => { e.target.style.display = 'none'; }}
                className="w-10 h-10 rounded-xl object-cover border border-white/20 shadow-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl shadow-md border border-white/10" aria-hidden="true">
                🎮
              </div>
            )}
          </div>
        </div>

        <div className={`px-5 py-3.5 ${darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900' : 'bg-white'}`}>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{server}</h2>
          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Panel de control del servidor</p>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl p-4 border shadow-sm ${panelBg}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${data.running ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
            <Activity size={16} className={data.running ? 'text-green-400' : 'text-red-400'} />
          </div>
          <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Estado</p>
          <p className={`text-sm font-bold ${data.running
            ? (darkMode ? 'text-green-400' : 'text-green-600')
            : (darkMode ? 'text-red-400' : 'text-red-600')
          }`}>
            {data.running ? 'Activo' : 'Detenido'}
          </p>
          {data.pid && <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>PID {data.pid}</p>}
        </div>

        <div className={`rounded-2xl p-4 border shadow-sm ${panelBg}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${data.ping?.up ? 'bg-green-500/15' : 'bg-gray-500/15'}`}>
            <Wifi size={16} className={data.ping?.up ? 'text-green-400' : (darkMode ? 'text-gray-500' : 'text-gray-400')} />
          </div>
          <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Conexión</p>
          <p className={`text-sm font-bold ${data.ping?.up
            ? (darkMode ? 'text-green-400' : 'text-green-600')
            : (darkMode ? 'text-gray-500' : 'text-gray-500')
          }`}>
            {data.ping?.up ? 'Online' : 'Offline'}
          </p>
          {data.ping?.up && (
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              {data.players?.online ?? 0}/{data.players?.max ?? 0} jugadores
            </p>
          )}
        </div>

        <div className={`rounded-2xl p-4 border shadow-sm ${panelBg}`}>
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center mb-3">
            <Tag size={16} className="text-purple-400" />
          </div>
          <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Versión</p>
          <p className={`text-sm font-bold ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
            {data.version || 'N/A'}
          </p>
        </div>
      </div>

      {/* ── Botones de control ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onStart(server)} disabled={data.running}
            aria-label={`Iniciar servidor ${server}`} aria-disabled={data.running}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${data.running
              ? darkMode ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border border-gray-700/30' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-900/30 hover:scale-[1.02] active:scale-95'
            }`}
          >
            <Play size={15} aria-hidden="true" /> Iniciar
          </button>

          <button
            onClick={() => onStop(server)} disabled={!data.running}
            aria-label={`Detener servidor ${server}`} aria-disabled={!data.running}
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

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setLogsVisible(v => !v)}
            aria-expanded={logsVisible} aria-controls={logsId}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
              ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50'
              : 'border-purple-400/40 text-purple-700 hover:bg-purple-50 hover:border-purple-500/60'
            }`}
          >
            <FileText size={14} aria-hidden="true" />
            {logsVisible ? 'Ocultar Logs' : 'Ver Logs'}
          </button>

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
      </div>

      {/* ── Terminal (logs + consola) ──────────────────────────────────────── */}
      {logsVisible && (
        <div className={`rounded-2xl overflow-hidden shadow-lg border ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
          {/* Cabecera tipo macOS terminal */}
          <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${darkMode ? 'bg-gray-800 border-gray-700/60' : 'bg-gray-100 border-gray-200'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 shrink-0" />
            <div className={`flex items-center gap-1.5 ml-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Terminal size={12} />
              <span className="text-xs font-medium font-mono">{server} — logs</span>
            </div>
          </div>

          {/* Output */}
          <pre
            id={logsId}
            ref={preRef}
            aria-live="polite"
            aria-atomic="false"
            className="h-56 md:h-80 overflow-y-scroll px-4 py-3 font-mono text-xs leading-relaxed bg-gray-950 text-green-400 custom-scrollbar"
          >
            {logs || '// Esperando logs...'}
          </pre>

          {/* Línea de entrada */}
          <div className={`flex items-center gap-2.5 px-4 py-2.5 border-t ${darkMode ? 'bg-gray-900 border-gray-700/60' : 'bg-gray-50 border-gray-200'}`}>
            <span className="text-green-500 font-mono text-sm shrink-0 select-none">$</span>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
              placeholder="escribe un comando..."
              disabled={!data.running}
              aria-label={`Comando para el servidor ${server}`}
              aria-disabled={!data.running}
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
    </div>
  );
}
