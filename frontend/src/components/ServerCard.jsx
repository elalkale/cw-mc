import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function ServerCard({ server, data, onStart, onStop }) {
  const [logs, setLogs] = useState('');
  const [logsVisible, setLogsVisible] = useState(false);
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

    return () => {
      socket.current.disconnect();
    };
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
    <div style={{ border: '1px solid #ccc', padding: 10, margin: 10 }}>
      <h3>{server}</h3>
      <p>Running: {data.running ? '✅' : '❌'} {data.pid ? `(PID: ${data.pid})` : ''}</p>
      <p>Ping: {data.ping?.up ? `UP — players: ${data.ping.players}` : 'DOWN'}</p>

      <button onClick={() => onStart(server)}>Start</button>
      <button onClick={() => onStop(server)}>Stop</button>
      <button onClick={() => setLogsVisible(!logsVisible)}>
        {logsVisible ? 'Ocultar Logs' : 'Ver Logs'}
      </button>

      {logsVisible && <pre ref={preRef} style={{ height: 200, overflowY: 'scroll', background: '#eee', padding: 5 }}>{logs}</pre>}

      <div>
        <input value={command} onChange={e => setCommand(e.target.value)} placeholder="Comando..." disabled={!data.running} />
        <button onClick={sendCommand} disabled={!data.running}>Enviar</button>
      </div>
    </div>
  );
}

