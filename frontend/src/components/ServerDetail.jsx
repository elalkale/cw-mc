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
    <div className="flex flex-col space-y-4">

      <button
        onClick={onBack}
        className="bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg w-fit"
      >
        ← Volver
      </button>

      <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{server}</h2>

      {/* Estado y ping como en la card */}
      <p className="text-gray-700 dark:text-gray-300">
        Running: {data.running ? '✅ Activo' : '❌ Detenido'}{' '}
        {data.pid ? `(PID: ${data.pid})` : ''}
      </p>

      <p className={`${data.ping?.up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'} font-medium`}>
        Ping: {data.ping?.up ? `UP — players: ${data.ping.players}` : 'DOWN'}
      </p>

      {/* Botones Start/Stop */}
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

      {/* Logs */}
      {logsVisible && (
        <pre ref={preRef} className="h-96 overflow-y-scroll bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm text-gray-800 dark:text-gray-200">
          {logs}
        </pre>
      )}

      {/* Input de comandos */}
      <div className="flex gap-2">
        <input
          value={command}
          onChange={e => setCommand(e.target.value)}
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
