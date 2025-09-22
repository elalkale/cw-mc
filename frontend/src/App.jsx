import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm.jsx';
import ServerCard from './components/ServerCard.jsx';
import ServerDetail from './components/ServerDetail.jsx';
import Navbar from './components/Navbar.jsx';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [servers, setServers] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const [activeServer, setActiveServer] = useState(null);

  const toggleDarkMode = () => setDarkMode(prev => !prev);


  const fetchStatus = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/status', { credentials: 'include' });
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
    await fetch('http://localhost:4000/logout', { method: 'POST', credentials: 'include' });
    setLoggedIn(false);
  };

  if (!loggedIn) return <LoginForm onLogin={() => setLoggedIn(true)} />;

  return (
    <div className={darkMode ? "dark" : ""}>
      
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6 relative transition-colors">
      <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      <div className="max-w-7xl mx-auto mt-6">

        {/* Dashboard o detalle */}
        {activeServer ? (
          <ServerDetail
            server={activeServer}
            data={servers[activeServer]}
            onStart={startServer}
            onStop={stopServer}
            onBack={() => setActiveServer(null)}
          />
        ) : (
          <>
            <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-8 text-center">
              Panel de Servidores Minecraft
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(servers).map(([name, data]) => (
                <ServerCard
                  key={name}
                  server={name}
                  data={data}
                  onStart={startServer}
                  onStop={stopServer}
                  onOpen={() => setActiveServer(name)}
                />
              ))}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
