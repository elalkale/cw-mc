import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function ServerDetail({ server, data, onStart, onStop, onBack }) {
  const [logs, setLogs] = useState('');
  const [logsVisible, setLogsVisible] = useState(true);
  const [command, setCommand] = useState('');
  const preRef = useRef();
  const socket = useRef(null);

  useEffect(() => {
    socket.current = io('http://localhost:4000', { withCredentials: true });
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

  return (
    <div className="flex flex-col space-y-4 px-4 max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg w-fit"
      >
        ← Volver
      </button>

      {/* Encabezado */}
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
        <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {server}
        </h2>
      </div>

      {/* Estado */}
      <p className="text-gray-700 dark:text-gray-300">
        Running: {data.running ? '✅ Activo' : '❌ Detenido'}{' '}
        {data.pid ? `(PID: ${data.pid})` : ''}
      </p>

      <p
        className={`${
          data.ping?.up
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-500 dark:text-red-400'
        } font-medium`}
      >
        Ping:{' '}
        {data.ping?.up
          ? `UP — jugadores: ${data.players?.online ?? 0}/${data.players?.max ?? 0}`
          : 'DOWN'}
      </p>

      <p className="text-gray-700 dark:text-gray-300">
        Versión: {data.version || 'N/A'}
      </p>

      {/* Botones */}
      <div className="flex gap-2">
        <button
          onClick={() => onStart(server)}
          disabled={data.running}
          className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors ${
            data.running
              ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600'
          }`}
        >
          Start
        </button>

        <button
          onClick={() => onStop(server)}
          disabled={!data.running}
          className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors ${
            !data.running
              ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
          }`}
        >
          Stop
        </button>

        <button
          onClick={() => setLogsVisible(!logsVisible)}
          className="flex-1 py-2 rounded-lg border border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-700/20 transition-colors"
        >
          {logsVisible ? 'Ocultar Logs' : 'Ver Logs'}
        </button>
      </div>

      {/* 👇 Jugadores conectados */}
      <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Jugadores conectados ({data?.players?.online ?? 0})
        </h3>
        <div className="flex flex-col gap-3">
          {data?.players?.sample?.length > 0 ? (
            data.players.sample.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <img
                  src={`https://crafatar.com/avatars/${p.id}?overlay`}
                  alt={p.name}
                  className="w-8 h-8 rounded"
                />
                <span className="text-gray-800 dark:text-gray-200">{p.name}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No hay jugadores conectados</p>
          )}
        </div>
      </div>

      {/* Logs */}
      {logsVisible && (
        <pre
          ref={preRef}
          className="h-96 overflow-y-scroll bg-gray-200 dark:bg-gray-700 p-3 rounded-md text-sm text-gray-800 dark:text-gray-200 px-4"
        >
          {logs}
        </pre>
      )}

      {/* Input de comandos */}
      <div className="flex gap-2 pt-2 pb-8 px-4">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Comando..."
          disabled={!data.running}
          className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 transition disabled:bg-gray-200 dark:disabled:bg-gray-600"
        />
        <button
          onClick={sendCommand}
          disabled={!data.running}
          className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
            !data.running
              ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600'
          }`}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
