
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ServerDetail from '../components/ServerDetail.jsx';
import {
  ArrowLeft, Sun, Moon, Cloud, CloudRain, Zap, Shield, Users,
} from 'lucide-react';

const QUICK_CMDS = [
  { label: 'Día',       cmd: 'time set day',    Icon: Sun,       cls: 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-400/50' },
  { label: 'Noche',     cmd: 'time set night',  Icon: Moon,      cls: 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-400/50' },
  { label: 'Despejado', cmd: 'weather clear',   Icon: Cloud,     cls: 'border-sky-500/30    text-sky-400    hover:bg-sky-500/10    hover:border-sky-400/50'    },
  { label: 'Lluvia',    cmd: 'weather rain',    Icon: CloudRain, cls: 'border-blue-500/30   text-blue-400   hover:bg-blue-500/10   hover:border-blue-400/50'   },
  { label: 'Tormenta',  cmd: 'weather thunder', Icon: Zap,       cls: 'border-amber-500/30  text-amber-400  hover:bg-amber-500/10  hover:border-amber-400/50'  },
  { label: 'OP',        cmd: 'op akalex07',     Icon: Shield,    cls: 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50' },
];

export default function ServerDetailPage({ servers, startServer, stopServer, forceStopServer, sendCommand, darkMode }) {
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
          <ArrowLeft size={18} aria-hidden="true" />
          Volver al Dashboard
        </button>
        <div role="alert" className="bg-gradient-to-r from-red-900/30 to-pink-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl">
          Servidor no encontrado
        </div>
      </div>
    );
  }

  const panelBg = darkMode
    ? 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25'
    : 'bg-gradient-to-br from-white to-purple-50/60 border-purple-200/70';

  return (
    <div className={`max-w-7xl mx-auto mt-2 md:mt-6 px-4 md:px-6 pb-8 transition-colors duration-300 space-y-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>

      {/* Botón volver */}
      <button
        onClick={() => navigate('/dashboard')}
        aria-label="Volver al Dashboard de servidores"
        className={`w-fit flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl transition-all border group ${darkMode
          ? 'bg-gray-800/60 hover:bg-gray-800 text-gray-300 border-gray-700/60 hover:border-gray-600'
          : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
        }`}
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
        Volver
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start">

        {/* ── Columna principal (ServerDetail) ── */}
        <div className="md:col-span-2">
          <ServerDetail
            server={serverName}
            data={data}
            onStart={startServer}
            onStop={stopServer}
            onForceStop={forceStopServer}
            onDelete={() => navigate('/dashboard')}
            darkMode={darkMode}
          />
        </div>

        {/* ── Columna derecha: jugadores + comandos rápidos ── */}
        <div className="md:col-span-1 flex flex-col gap-4">

          {/* Jugadores */}
          <div className={`rounded-2xl shadow-sm p-4 md:p-5 border transition-colors ${panelBg}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-50'}`}>
                  <Users size={14} className="text-purple-400" />
                </div>
                <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Jugadores en línea
                </h3>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                (data?.players?.online ?? 0) > 0
                  ? 'bg-green-500/20 text-green-400'
                  : darkMode ? 'bg-gray-700/60 text-gray-500' : 'bg-purple-100 text-purple-500'
              }`}>
                {data?.players?.online ?? 0}/{data?.players?.max ?? 0}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {data?.players?.sample?.length > 0 ? (
                data.players.sample.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${darkMode
                      ? 'bg-purple-950/20 border-purple-700/30 hover:border-purple-500/50'
                      : 'bg-purple-50/60 border-purple-200/60 hover:border-purple-300'
                    }`}
                  >
                    <img
                      src={`https://crafatar.com/avatars/${p.id}?overlay`}
                      alt={`Avatar de ${p.name}`}
                      className="w-8 h-8 rounded-lg flex-shrink-0 border border-purple-500/20"
                    />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {p.name}
                      </p>
                      <p className="text-xs text-green-500">en línea</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`flex flex-col items-center justify-center gap-2 py-8 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                  <Users size={28} className="opacity-30" />
                  <p className="text-xs text-center">No hay jugadores conectados</p>
                </div>
              )}
            </div>
          </div>

          {/* Comandos rápidos */}
          <div className={`rounded-2xl shadow-sm p-4 border transition-colors ${panelBg}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-50'}`}>
                <Zap size={14} className="text-purple-400" />
              </div>
              <h2 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Comandos Rápidos
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {QUICK_CMDS.map(({ label, cmd, Icon, cls }) => (
                <button
                  key={cmd}
                  onClick={() => sendCommand(serverName, cmd)}
                  aria-label={`${label}: ${cmd}`}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium border transition-all hover:scale-[1.03] active:scale-95 ${cls}`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
