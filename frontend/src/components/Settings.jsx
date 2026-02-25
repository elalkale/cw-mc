import React, { useState, useEffect } from 'react';
import { FolderOpen, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api.js';

export default function Settings({ darkMode }) {
  const [serverRoot, setServerRoot] = useState('');
  const [message, setMessage]       = useState('');
  const [saving, setSaving]         = useState(false);
  const isSuccess = message && !message.toLowerCase().startsWith('error');

  useEffect(() => {
    fetchWithToken(`${API_BASE}/api/settings`)
      .then(res => res.json())
      .then(data => { if (data.serverRoot) setServerRoot(data.serverRoot); })
      .catch(() => setMessage('Error al cargar la configuración.'));
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetchWithToken(`${API_BASE}/api/settings`, {
        method: 'POST',
        body: JSON.stringify({ serverRoot }),
      });
      const data = await res.json();
      setMessage(res.ok ? 'Configuración guardada correctamente.' : `Error: ${data.error}`);
    } catch {
      setMessage('Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Campo: directorio raíz */}
      <div>
        <label
          htmlFor="server-root-input"
          className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
        >
          <FolderOpen size={13} className={darkMode ? 'text-purple-400' : 'text-purple-500'} />
          Directorio raíz de servidores
        </label>
        <input
          id="server-root-input"
          type="text"
          value={serverRoot}
          onChange={e => setServerRoot(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveSettings(); }}
          disabled={saving}
          placeholder="C:\servers"
          className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none font-mono ${darkMode
            ? 'bg-gray-950 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
            : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
          } disabled:opacity-50`}
        />
        <p className={`mt-1.5 text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
          Ruta absoluta donde se almacenan las carpetas de cada servidor.
        </p>
      </div>

      {/* Mensaje feedback */}
      {message && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs border ${
          isSuccess
            ? darkMode
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-green-50 border-green-200 text-green-700'
            : darkMode
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {isSuccess
            ? <CheckCircle size={13} className="shrink-0 mt-0.5" />
            : <AlertCircle size={13} className="shrink-0 mt-0.5" />
          }
          {message}
        </div>
      )}

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving
            ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />Guardando...</>
            : <><Save size={14} />Guardar</>
          }
        </button>
      </div>
    </div>
  );
}
