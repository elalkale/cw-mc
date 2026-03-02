import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export default function LogsConsole({ server, socket }) {
  const [logs, setLogs] = useState('');
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // Unirse al servidor
    socket.emit('join', server);

    const handleLog = ({ server: srv, line }) => {
      if (srv === server) setLogs(prev => prev + line);
    };

    const handleHistory = ({ server: srv, logs }) => {
      if (srv === server) setLogs(logs || '');
    };

    socket.on('log', handleLog);
    socket.on('log_history', handleHistory);

    return () => {
      socket.off('log', handleLog);
      socket.off('log_history', handleHistory);
    };
  }, [server, socket]);

  useLayoutEffect(() => {
    const el = preRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  return <pre ref={preRef} className="logs">{logs}</pre>;
}
