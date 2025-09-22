import React, { useState, useEffect } from 'react';

export default function LoginForm({ onLogin }) {
  const [username, setUser] = useState('');
  const [password, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); // Estado mientras verificamos sesión

  // --- Auto-login al cargar la app ---
  useEffect(() => {
    fetch('http://localhost:4000/api/me', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.loggedIn) {
          onLogin(); // Usuario ya logueado
        }
      })
      .catch(() => {
        // Ignoramos errores de conexión, solo seguimos al login
      })
      .finally(() => setLoading(false));
  }, [onLogin]);

  const login = async () => {
    setError('');
    try {
      const res = await fetch('http://localhost:4000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        onLogin();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('Error de conexión al backend');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 text-lg">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h2 className="text-3xl font-extrabold mb-6 text-purple-600 text-center">
          Login
        </h2>

        <input
          className="w-full mb-4 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
          placeholder="Usuario"
          value={username}
          onChange={e => setUser(e.target.value)}
        />

        <input
          type="password"
          className="w-full mb-4 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPass(e.target.value)}
        />

        <button
          onClick={login}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold shadow-md transition transform hover:scale-105"
        >
          Entrar
        </button>

        {error && <p className="text-red-500 mt-3 text-center">{error}</p>}

        <p className="text-sm text-gray-500 mt-4 text-center">
          ¿No tienes cuenta? <span className="text-purple-600 font-medium cursor-pointer hover:underline">Regístrate</span>
        </p>
      </div>
    </div>
  );
}
