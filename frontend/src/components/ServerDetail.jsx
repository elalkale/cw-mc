import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE, fetchWithToken } from '../lib/api.js';

export default function ServerDetail({ server, data, onStart, onStop, darkMode }) {
  const [logs, setLogs] = useState('');
  const [logsVisible, setLogsVisible] = useState(true);
  const [command, setCommand] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isCreatingLocal, setIsCreatingLocal] = useState(false);

  const preRef = useRef();
  const socket = useRef(null);

  const logsId = `detail-logs-${server.replace(/\s+/g, '-')}`;
  const cmdInputId = `detail-cmd-${server.replace(/\s+/g, '-')}`;

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
      a.href = url;
      a.download = `${server}_backup_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error backup:', err);
      alert('Error: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const createLocalBackup = async () => {
    setIsCreatingLocal(true);
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/backup/${encodeURIComponent(server)}/local`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear backup local');
      alert(`Backup creado en la carpeta "backups":\n${data.filename}`);
    } catch (err) {
      console.error('Error backup local:', err);
      alert('Error: ' + err.message);
    } finally {
      setIsCreatingLocal(false);
    }
  };

  const cardClass = `rounded-xl p-4 border transition-colors ${darkMode
    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
    : 'bg-gradient-to-br from-gray-100 to-gray-200 border-purple-400/50'
  }`;

  const labelClass = `text-xs font-semibold uppercase mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`;

  return (
    <div className="flex flex-col space-y-4">

      {/* Encabezado */}
      <div className={`rounded-2xl shadow-lg p-4 md:p-6 border flex items-center gap-3 md:gap-4 flex-wrap transition-colors ${darkMode
        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
        : 'bg-gradient-to-br from-gray-100 to-gray-200 border-purple-400/50'
      }`}>
        {data.icon ? (
          <img
            src={`${API_BASE}/api/server-icon/${encodeURIComponent(server)}`}
            alt={`Icono del servidor ${server}`}
            onError={(e) => { e.target.style.display = 'none'; }}
            className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border-2 border-purple-500/30 shadow-lg"
          />
        ) : (
          <div
            className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl shadow-lg"
            aria-hidden="true"
          >
            🎮
          </div>
        )}
        <div>
          <h2 className={`text-2xl md:text-3xl font-bold bg-clip-text text-transparent ${darkMode
            ? 'bg-gradient-to-r from-purple-300 to-pink-300'
            : 'bg-gradient-to-r from-purple-700 to-pink-700'
          }`}>
            {server}
          </h2>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
            Panel de control del servidor
          </p>
        </div>
      </div>

      {/* Estado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={cardClass}>
          <p className={labelClass}>Estado</p>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${data.running ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} aria-hidden="true" />
            <span className={`font-semibold text-sm md:text-base ${data.running
              ? darkMode ? 'text-green-400' : 'text-green-700'
              : darkMode ? 'text-red-400' : 'text-red-700'
            }`}>
              {data.running ? 'Activo' : 'Detenido'}
            </span>
          </div>
          {data.pid && <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>PID: {data.pid}</p>}
        </div>

        <div className={cardClass}>
          <p className={labelClass}>Conexión</p>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${data.ping?.up ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} aria-hidden="true" />
            <span className={`font-semibold text-sm md:text-base ${data.ping?.up
              ? darkMode ? 'text-green-400' : 'text-green-700'
              : darkMode ? 'text-red-400' : 'text-red-700'
            }`}>
              {data.ping?.up ? 'Activa' : 'Caída'}
            </span>
          </div>
        </div>

        <div className={cardClass}>
          <p className={labelClass}>Versión</p>
          <p className={`font-semibold text-sm md:text-base ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
            {data.version || 'N/A'}
          </p>
        </div>
      </div>

      {/* Botones de control */}
      <div className="flex gap-2 flex-col sm:flex-row flex-wrap">
        <button
          onClick={() => onStart(server)}
          disabled={data.running}
          aria-label={`Iniciar servidor ${server}`}
          aria-disabled={data.running}
          className={`flex-1 py-3 text-sm md:text-base rounded-lg font-semibold transition-all transform ${data.running
            ? darkMode
              ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border border-gray-700/50'
              : 'bg-gray-300/50 text-gray-500 cursor-not-allowed border border-gray-400/50'
            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-green-500/50 hover:scale-105 active:scale-95'
          }`}
        >
          <span aria-hidden="true">▶️ </span>Iniciar Servidor
        </button>

        <button
          onClick={() => onStop(server)}
          disabled={!data.running}
          aria-label={`Detener servidor ${server}`}
          aria-disabled={!data.running}
          className={`flex-1 py-3 text-sm md:text-base rounded-lg font-semibold transition-all transform ${!data.running
            ? darkMode
              ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border border-gray-700/50'
              : 'bg-gray-300/50 text-gray-500 cursor-not-allowed border border-gray-400/50'
            : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg hover:shadow-red-500/50 hover:scale-105 active:scale-95'
          }`}
        >
          <span aria-hidden="true">⏹️ </span>Detener Servidor
        </button>

        <button
          onClick={() => setLogsVisible(v => !v)}
          aria-expanded={logsVisible}
          aria-controls={logsId}
          className={`flex-1 py-3 text-sm md:text-base rounded-lg font-semibold border-2 transition-all transform hover:scale-105 active:scale-95 ${darkMode
            ? 'border-purple-500/50 text-purple-300 hover:bg-purple-500/10'
            : 'border-purple-400/50 text-purple-600 hover:bg-purple-200/20'
          }`}
        >
          <span aria-hidden="true">📋 </span>
          {logsVisible ? 'Ocultar Logs' : 'Ver Logs'}
        </button>

        <button
          onClick={createLocalBackup}
          disabled={isCreatingLocal}
          aria-label={`Crear backup local del servidor ${server}`}
          className={`flex-1 py-3 text-sm md:text-base rounded-lg font-semibold border-2 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 ${darkMode
            ? 'border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/10'
            : 'border-indigo-400/50 text-indigo-600 hover:bg-indigo-200/20'
          } ${isCreatingLocal ? 'opacity-50 cursor-not-allowed scale-100 text-gray-400 border-gray-500' : ''}`}
        >
          {isCreatingLocal
            ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-current animate-spin" aria-hidden="true" />
            : <span aria-hidden="true">💾 </span>}
          {isCreatingLocal ? 'Creando...' : 'Backup Local'}
        </button>

        <button
          onClick={downloadBackup}
          disabled={isBackingUp}
          aria-label={`Descargar backup del servidor ${server}`}
          className={`flex-1 py-3 text-sm md:text-base rounded-lg font-semibold border-2 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 ${darkMode
            ? 'border-blue-500/50 text-blue-300 hover:bg-blue-500/10'
            : 'border-blue-400/50 text-blue-600 hover:bg-blue-200/20'
          } ${isBackingUp ? 'opacity-50 cursor-not-allowed scale-100 text-gray-400 border-gray-500' : ''}`}
        >
          {isBackingUp
            ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-current animate-spin" aria-hidden="true" />
            : <span aria-hidden="true">⬇️ </span>}
          {isBackingUp ? 'Descargando...' : 'Descargar ZIP'}
        </button>
      </div>

      {/* Logs */}
      {logsVisible && (
        <div className={`rounded-2xl shadow-lg p-3 md:p-4 border transition-colors ${darkMode
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
          : 'bg-gradient-to-br from-gray-100 to-gray-200 border-purple-400/50'
        }`}>
          <h3
            id={`${logsId}-label`}
            className={`text-sm md:text-base font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}
          >
            <span aria-hidden="true">📄</span> Registros del Servidor
          </h3>
          <pre
            id={logsId}
            ref={preRef}
            aria-labelledby={`${logsId}-label`}
            aria-live="polite"
            aria-atomic="false"
            className={`h-48 sm:h-64 md:h-96 overflow-y-scroll p-3 rounded-lg font-mono border ${darkMode
              ? 'bg-black/40 text-green-400 border-green-500/20'
              : 'bg-gray-50 text-green-800 border-green-500/30'
            } text-xs md:text-sm`}
          >
            {logs || 'Cargando logs...'}
          </pre>
        </div>
      )}

      {/* Consola de comandos */}
      <div className={`rounded-2xl shadow-lg p-3 md:p-4 border transition-colors ${darkMode
        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
        : 'bg-gradient-to-br from-gray-100 to-gray-200 border-purple-400/50'
      }`}>
        <h3 className={`text-sm md:text-base font-bold mb-3 ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
          <span aria-hidden="true">⌨️ </span>Consola de comandos
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor={cmdInputId} className="sr-only">
            Escribe un comando para el servidor {server}
          </label>
          <input
            id={cmdInputId}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
            placeholder="Escribe un comando..."
            disabled={!data.running}
            aria-disabled={!data.running}
            className={`flex-1 p-3 text-sm rounded-lg focus:outline-none transition border-2 font-mono ${darkMode
              ? 'bg-black/40 border-purple-500/30 focus:border-purple-500 text-green-400 placeholder-green-700/50'
              : 'bg-gray-50 border-purple-500/40 focus:border-purple-600 text-green-800 placeholder-green-700'
            }`}
          />
          <button
            onClick={sendCommand}
            disabled={!data.running}
            aria-label="Enviar comando al servidor"
            aria-disabled={!data.running}
            className={`px-4 md:px-6 py-3 text-sm font-semibold rounded-lg transition-all transform ${!data.running
              ? darkMode
                ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border border-gray-700/50'
                : 'bg-gray-300/50 text-gray-500 cursor-not-allowed border border-gray-400/50'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-purple-500/50 hover:scale-105 active:scale-95'
            }`}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
