import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm.jsx';
import ServerCard from './components/ServerCard.jsx';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [servers, setServers] = useState({});

  const fetchStatus = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/status', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      } else if (res.status === 401) {
        setLoggedIn(false);
      }
    } catch (err) {
      console.error('Error fetchStatus:', err);
    }
  };

  useEffect(() => {
    if (loggedIn) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [loggedIn]);

  const startServer = async (name) => {
    await fetch('http://localhost:4000/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name })
    });
    setTimeout(fetchStatus, 1000);
  };

  const stopServer = async (name) => {
    await fetch('http://localhost:4000/api/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name })
    });
    setTimeout(fetchStatus, 1000);
  };

  const logout = async () => {
    await fetch('http://localhost:4000/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setLoggedIn(false);
  };

  if (!loggedIn) return <LoginForm onLogin={() => setLoggedIn(true)} />;

  return (
    <div style={{ padding: 20 }}>
      <button onClick={logout} style={{ position: 'absolute', top: 10, right: 10 }}>Cerrar sesión</button>
      <h1>Panel de Servidores Minecraft</h1>
      {Object.entries(servers).map(([name, data]) => (
        <ServerCard
          key={name}
          server={name}
          data={data}
          onStart={startServer}
          onStop={stopServer}
        />
      ))}
    </div>
  );
}
