import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ServerDetail from '../components/ServerDetail.jsx';
import FileExplorer from '../components/FileExplorer.jsx';
import { ArrowLeft } from 'lucide-react';

export default function ServerDetailPage({ servers, startServer, stopServer, sendCommand, darkMode }) {
  const { serverName } = useParams();
  const navigate = useNavigate();

  const data = servers[serverName];

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto mt-6 p-4 md:p-6">
        <button
          onClick={() => navigate('/dashboard')}
          aria-label="Volver al Dashboard"
          className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition mb-6"
        >
          <ArrowLeft size={20} aria-hidden="true" />
          Volver al Dashboard
        </button>
        {/* role="alert" para que los lectores anuncien el error inmediatamente (WCAG 3.3.1) */}
        <div
          role="alert"
          className="bg-gradient-to-r from-red-900/30 to-pink-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg"
        >
          <span aria-hidden="true">⚠️ </span>Servidor no encontrado
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto mt-2 md:mt-6 px-4 md:px-6 pb-8 transition-colors duration-300 space-y-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
      <button
        onClick={() => navigate('/dashboard')}
        aria-label="Volver al Dashboard de servidores"
        className={`w-fit px-4 py-2 text-sm md:text-base rounded-lg transition border flex items-center gap-2 group ${darkMode
          ? 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border-purple-500/30'
          : 'bg-purple-200/30 hover:bg-purple-300/30 text-purple-700 border-purple-400/50'
          }`}
      >
        {/* Flecha decorativa oculta para lectores — el texto "Volver" es suficiente */}
        <span className="group-hover:-translate-x-1 transition" aria-hidden="true">←</span>
        Volver
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Columna principal */}
        <div className="md:col-span-2 space-y-4 md:space-y-6">
          <ServerDetail
            server={serverName}
            data={data}
            onStart={startServer}
            onStop={stopServer}
            darkMode={darkMode}
          />

          {/* Comandos rápidos */}
          <div className={`rounded-2xl shadow-lg p-4 md:p-6 border transition-colors ${darkMode
            ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
            : 'bg-gradient-to-br from-gray-100 to-gray-200 border-purple-400/50'
            }`}>
            <h2 className={`text-lg md:text-xl font-bold bg-clip-text text-transparent mb-4 ${darkMode ? 'bg-gradient-to-r from-purple-300 to-pink-300' : 'bg-gradient-to-r from-purple-700 to-pink-700'
              }`}>
              <span aria-hidden="true">⚡ </span>Comandos Rápidos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
              <button
                onClick={() => sendCommand(serverName, 'time set day')}
                aria-label="Establecer tiempo de día en el servidor"
                className="px-2 md:px-4 py-2 text-sm md:text-base bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Día
              </button>
              <button
                onClick={() => sendCommand(serverName, 'time set night')}
                aria-label="Establecer tiempo de noche en el servidor"
                className="px-2 md:px-4 py-2 text-sm md:text-base bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
              >
                Noche
              </button>
              <button
                onClick={() => sendCommand(serverName, 'weather clear')}
                aria-label="Limpiar el clima del servidor"
                className="px-2 md:px-4 py-2 text-sm md:text-base bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
              >
                Clima
              </button>
              <button
                onClick={() => sendCommand(serverName, 'weather rain')}
                aria-label="Activar lluvia en el servidor"
                className="px-2 md:px-4 py-2 text-sm md:text-base bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
              >
                Lluvia
              </button>
              <button
                onClick={() => sendCommand(serverName, 'weather thunder')}
                aria-label="Activar tormenta en el servidor"
                className="px-2 md:px-4 py-2 text-sm md:text-base bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition"
              >
                Tormenta
              </button>
              <button
                onClick={() => sendCommand(serverName, 'op akalex07')}
                aria-label="Dar permisos de operador (OP) a akalex07"
                className="px-2 md:px-4 py-2 text-sm md:text-base bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
              >
                OP
              </button>
            </div>
          </div>
        </div>

        {/* Columna derecha: jugadores conectados */}
        <div className="md:col-span-1">
          <div className={`rounded-2xl shadow-lg p-4 md:p-6 border transition-colors ${darkMode
            ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
            : 'bg-gradient-to-br from-gray-100 to-gray-200 border-purple-400/50'
            }`}>
            <h3 className={`text-base md:text-lg font-bold bg-clip-text text-transparent mb-4 ${darkMode ? 'bg-gradient-to-r from-purple-300 to-pink-300' : 'bg-gradient-to-r from-purple-700 to-pink-700'
              }`}>
              {/* Emoji decorativo */}
              <span aria-hidden="true">👥 </span>
              Jugadores en línea ({data?.players?.online ?? 0})
            </h3>
            <div className="flex flex-col gap-3">
              {data?.players?.sample?.length > 0 ? (
                data.players.sample.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 md:gap-3 p-2 rounded-lg border transition ${darkMode
                      ? 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40'
                      : 'bg-purple-200/30 border-purple-400/50 hover:border-purple-500/70'
                      }`}
                  >
                    <img
                      src={`https://crafatar.com/avatars/${p.id}?overlay`}
                      alt={`Avatar de ${p.name}`}
                      className="w-8 h-8 rounded-lg flex-shrink-0 border border-purple-500/30"
                    />
                    <span className={`text-sm md:text-base truncate font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-800'
                      }`}>
                      {p.name}
                    </span>
                  </div>
                ))
              ) : (
                <p className={`text-sm text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                  No hay jugadores conectados
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* haz que el contenedor siempre tenga 400px de altura */}
      <div className="mt-4 h-[400px] min-h-[400px]">
        <FileExplorer serverName={serverName} />
      </div>
    </div>
  );
}
