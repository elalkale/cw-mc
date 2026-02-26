import React, { useState } from 'react';
import { API } from '../constants';

interface Props {
  onLogin: () => void;
  darkMode?: boolean;
}

export default function LoginForm({ onLogin, darkMode }: Props) {
  const [username, setUser] = useState('');
  const [password, setPass] = useState('');
  const [error, setError] = useState('');

  const login = async (e: React.FormEvent) => {
    e?.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    try {
      const res = await fetch(API.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('authToken', data.token);
        onLogin();
      } else {
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch {
      setError('Error de conexión al backend');
    }
  };

  return (
    <div
      className={`flex items-center justify-center min-h-screen relative overflow-hidden ${darkMode
        ? 'bg-gradient-to-br from-purple-900 via-gray-900 to-black'
        : 'bg-gradient-to-br from-purple-50 via-white to-purple-100'
      }`}
    >
      {/* Decorativos */}
      <div
        className={`absolute top-10 right-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse ${darkMode ? 'bg-purple-500' : 'bg-purple-400'}`}
        aria-hidden="true"
      />
      <div
        className={`absolute bottom-10 left-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse ${darkMode ? 'bg-pink-500' : 'bg-pink-400'}`}
        style={{ animationDelay: '2s' }}
        aria-hidden="true"
      />

      <div
        className={`relative backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-sm border transition-colors ${darkMode
          ? 'bg-gray-800/40 border-purple-500/20'
          : 'bg-white/40 border-purple-300/30'
        }`}
      >
        <div className="text-center mb-8">
          <img
            src="/assets/logo.png"
            alt="Logo del Panel Minecraft"
            className="w-20 h-20 mx-auto mb-4 drop-shadow-lg"
          />
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Minecraft Panel
          </h1>
          <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Administra tus servidores
          </p>
        </div>

        <form onSubmit={login} noValidate>
          <div className="mb-4">
            <label
              htmlFor="username-input"
              className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Usuario
            </label>
            <input
              id="username-input"
              type="text"
              autoComplete="username"
              className={`w-full p-3 rounded-lg transition border ${darkMode
                ? 'bg-gray-700/50 border-purple-500/30 text-white placeholder-gray-400'
                : 'bg-white/70 border-purple-300/50 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={(e) => setUser(e.target.value)}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'login-error' : 'username-hint'}
              required
            />
            <span id="username-hint" className="sr-only">Campo de usuario para iniciar sesión</span>
          </div>

          <div className="mb-6">
            <label
              htmlFor="password-input"
              className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Contraseña
            </label>
            <input
              id="password-input"
              type="password"
              autoComplete="current-password"
              className={`w-full p-3 rounded-lg transition border ${darkMode
                ? 'bg-gray-700/50 border-purple-500/30 text-white placeholder-gray-400'
                : 'bg-white/70 border-purple-300/50 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPass(e.target.value)}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'login-error' : 'password-hint'}
              required
            />
            <span id="password-hint" className="sr-only">Campo de contraseña para iniciar sesión</span>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-lg font-semibold shadow-lg transition transform hover:scale-105 active:scale-95"
            aria-label="Iniciar sesión en el panel"
          >
            Entrar
          </button>
        </form>

        {error && (
          <div
            id="login-error"
            role="alert"
            aria-live="assertive"
            className={`mt-4 p-3 rounded-lg text-sm text-center border ${darkMode
              ? 'bg-red-500/20 border-red-500/50 text-red-300'
              : 'bg-red-100 border-red-300 text-red-700'
            }`}
          >
            {error}
          </div>
        )}

        <p className={`text-sm mt-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Desarrollado por{' '}
          <span className={`font-medium ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
            Alejandro S. &amp; Jesús G.
          </span>
        </p>
      </div>
    </div>
  );
}
