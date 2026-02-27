import React, { useState } from 'react';
import { User, Lock, LogIn, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { API } from '../constants';

interface Props {
  onLogin: () => void;
  darkMode?: boolean;
}

export default function LoginForm({ onLogin, darkMode }: Props) {
  const [username, setUser] = useState('');
  const [password, setPass] = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoad]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const login = async (e: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!username || !password) { setError('Por favor completa todos los campos'); return; }

    setLoad(true);
    try {
      const res  = await fetch(API.LOGIN, {
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
    } finally {
      setLoad(false);
    }
  };

  const inputCls = `w-full pl-9 pr-3 py-2.5 rounded-xl text-sm border transition-colors focus:outline-none ${
    darkMode
      ? 'bg-gray-900/80 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
      : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
  }`;

  const iconCls = `absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
    darkMode ? 'text-gray-500' : 'text-gray-400'
  }`;

  return (
    <div className={`flex items-center justify-center min-h-screen relative overflow-hidden ${
      darkMode
        ? 'bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950/20'
        : 'bg-gradient-to-br from-gray-100 via-white to-purple-50'
    }`}>
      {/* Decos de fondo */}
      <div
        className={`absolute top-1/4 right-1/4 w-80 h-80 rounded-full filter blur-3xl opacity-10 animate-pulse pointer-events-none ${darkMode ? 'bg-purple-600' : 'bg-purple-400'}`}
        aria-hidden="true"
      />
      <div
        className={`absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full filter blur-3xl opacity-10 animate-pulse pointer-events-none ${darkMode ? 'bg-pink-600' : 'bg-pink-400'}`}
        style={{ animationDelay: '2s' }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm px-4">

        {/* Branding */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-3 ${
            darkMode
              ? 'bg-gray-800/80 border border-gray-700/60 shadow-xl shadow-black/30'
              : 'bg-white border border-gray-200 shadow-lg'
          }`}>
            <img
              src="/assets/logo.png"
              alt="Logo"
              className="w-20 h-20 object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            CW-MC Panel
          </h1>
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Administrador de servidores Minecraft
          </p>
        </div>

        {/* Tarjeta */}
        <div className={`rounded-2xl border p-6 ${
          darkMode
            ? 'bg-gray-800/70 border-gray-700/60 shadow-2xl shadow-black/40 backdrop-blur-xl'
            : 'bg-white border-gray-200 shadow-xl shadow-gray-200/80'
        }`}>
          <form onSubmit={login} noValidate className="space-y-4">

            {/* Usuario */}
            <div>
              <label
                htmlFor="username-input"
                className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Usuario
              </label>
              <div className="relative">
                <User size={14} className={iconCls} aria-hidden="true" />
                <input
                  id="username-input"
                  type="text"
                  autoComplete="username"
                  className={inputCls}
                  placeholder="Tu usuario"
                  value={username}
                  onChange={e => setUser(e.target.value)}
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label
                htmlFor="password-input"
                className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock size={14} className={iconCls} aria-hidden="true" />
                <input
                  id="password-input"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`${inputCls} pr-9 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden`}
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={e => setPass(e.target.value)}
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400 transition-colors"
                >
                  {showPass ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                id="login-error"
                role="alert"
                aria-live="assertive"
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs border ${
                  darkMode
                    ? 'bg-red-500/10 border-red-500/25 text-red-400'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Iniciar sesión en el panel"
            >
              {loading
                ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                : <LogIn size={14} aria-hidden="true" />
              }
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className={`text-xs mt-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
          Desarrollado por{' '}
          <span className={`font-medium ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
            Alejandro S. &amp; Jesús G.
          </span>
        </p>
      </div>
    </div>
  );
}
