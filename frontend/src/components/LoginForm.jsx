import React, { useState, useEffect } from 'react';

export default function LoginForm({ onLogin, darkMode }) {
  const [username, setUser] = useState('');
  const [password, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Verificar sesión al cargar
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch('http://localhost:4000/api/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.loggedIn) {
            onLogin();
            return;
          }
        } else {
          // Token inválido, limpiarlo
          localStorage.removeItem('authToken');
        }
      } catch (err) {
        console.error('Error verificando sesión:', err);
      }
      setLoading(false);
    };

    checkSession();
  }, [onLogin]);

  const login = async (e) => {
    e?.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    try {
      const res = await fetch('http://localhost:4000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('authToken', data.token);
        onLogin();
      } else {
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('Error de conexión al backend');
    }
  };

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center min-h-screen ${darkMode
            ? 'bg-gradient-to-br from-purple-900 via-gray-900 to-black'
            : 'bg-gradient-to-br from-purple-100 via-white to-purple-50'
          }`}
      >
        {/* role="status" + aria-label para lectores de pantalla (WCAG 4.1.3) */}
        <div className="text-center" role="status" aria-label="Verificando sesión, por favor espere">
          <div
            className={`w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4 ${darkMode
                ? 'border-purple-500 border-t-transparent'
                : 'border-purple-400 border-t-transparent'
              }`}
            aria-hidden="true"
          />
          <p
            className={`text-lg font-semibold ${darkMode ? 'text-purple-300' : 'text-purple-600'
              }`}
          >
            Verificando sesión...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center min-h-screen relative overflow-hidden ${darkMode
          ? 'bg-gradient-to-br from-purple-900 via-gray-900 to-black'
          : 'bg-gradient-to-br from-purple-50 via-white to-purple-100'
        }`}
    >
      {/* Decorativos – aria-hidden para no contaminar lectores */}
      <div
        className={`absolute top-10 right-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse ${darkMode ? 'bg-purple-500' : 'bg-purple-400'
          }`}
        aria-hidden="true"
      />
      <div
        className={`absolute bottom-10 left-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse ${darkMode ? 'bg-pink-500' : 'bg-pink-400'
          }`}
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
          <div
            className="inline-block p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4"
            aria-hidden="true"
          >
            <span className="text-2xl" aria-hidden="true">🎮</span>
          </div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Minecraft Panel
          </h1>
          <p
            className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
          >
            Administra tus servidores
          </p>
        </div>

        <form onSubmit={login} noValidate>
          <div className="mb-4">
            <label
              htmlFor="username-input"
              className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
            >
              Usuario
            </label>
            <input
              id="username-input"
              type="text"
              /* autocomplete ayuda a gestores de contraseñas y autofill (WCAG 1.3.5) */
              autoComplete="username"
              className={`w-full p-3 rounded-lg transition border ${darkMode
                  ? 'bg-gray-700/50 border-purple-500/30 text-white placeholder-gray-400'
                  : 'bg-white/70 border-purple-300/50 text-gray-900 placeholder-gray-500'
                }`}
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={(e) => setUser(e.target.value)}
              /* onKeyPress deprecated — usar onKeyDown (WCAG 2.1.1) */
              onKeyDown={(e) => e.key === 'Enter' && login(e)}
              /* aria-invalid indica estado de error al lector (WCAG 3.3.1) */
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'login-error' : 'username-hint'}
              required
            />
            <span id="username-hint" className="sr-only">
              Campo de usuario para iniciar sesión
            </span>
          </div>

          <div className="mb-6">
            <label
              htmlFor="password-input"
              className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
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
              onKeyDown={(e) => e.key === 'Enter' && login(e)}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'login-error' : 'password-hint'}
              required
            />
            <span id="password-hint" className="sr-only">
              Campo de contraseña para iniciar sesión
            </span>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-lg font-semibold shadow-lg transition transform hover:scale-105 active:scale-95"
            aria-label="Iniciar sesión en el panel"
          >
            Entrar
          </button>
        </form>

        {/* aria-live="assertive" para que el error sea anunciado inmediatamente
            (WCAG 3.3.1 – Error Identification) */}
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

        <p
          className={`text-sm mt-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
        >
          Desarrollado por{' '}
          <span
            className={`font-medium ${darkMode ? 'text-purple-400' : 'text-purple-600'
              }`}
          >
            Alejandro S. &amp; Jesús G.
          </span>
        </p>
      </div>
    </div>
  );
}
