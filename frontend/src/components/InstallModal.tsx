import React from 'react';
import { Server, X } from 'lucide-react';

export default function InstallModal({ show, onClose, installFileLabel, serverNameInput, setServerNameInput, onInstall, darkMode }) {
  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-modal-title"
          className={`w-full max-w-md rounded-2xl shadow-2xl border pointer-events-auto ${darkMode
            ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30'
            : 'bg-white border-purple-200/70'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
                <Server size={14} className="text-purple-400" aria-hidden="true" />
              </div>
              <h3 id="install-modal-title" className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Instalar servidor</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar diálogo"
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {installFileLabel && (
              <p className={`text-xs px-3 py-2 rounded-xl border font-mono ${darkMode ? 'bg-gray-950 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                <span className={`font-sans font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Versión: </span>
                {installFileLabel}
              </p>
            )}
            <div>
              <label htmlFor="install-server-name" className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Nombre del servidor
              </label>
              <input
                id="install-server-name"
                type="text"
                value={serverNameInput}
                onChange={e => setServerNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onInstall(); }}
                placeholder="nombre-del-servidor"
                autoFocus
                className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode
                  ? 'bg-gray-950 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
                  : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
                }`}
              />
            </div>
          </div>

          <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
            >
              Cancelar
            </button>
            <button
              onClick={onInstall}
              disabled={!serverNameInput.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-900/20"
            >
              <Server size={14} />
              Instalar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
