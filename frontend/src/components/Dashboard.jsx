import React from 'react';
import { useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', { withCredentials: true });

export default function Dashboard() {

  useEffect(() => {
    socket.on('connect', () => console.log('Conectado a Socket.IO:', socket.id));
    socket.on('cmd_ack', data => console.log('Comando ACK:', data));
    return () => { socket.disconnect(); }
  }, []);

  const sendCommand = () => {
    socket.emit('command', { server: 'server1', command: 'say Hola!' });
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <button onClick={sendCommand}>Enviar comando de prueba</button>
    </div>
  );
}
