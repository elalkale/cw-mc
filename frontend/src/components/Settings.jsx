import React, { useState, useEffect } from 'react';
import { API_BASE, fetchWithToken } from '../lib/api.js';

export default function Settings({ darkMode }) {
  const [serverRoot, setServerRoot] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchWithToken(`${API_BASE}/api/settings`)
      .then(res => res.json())
      .then(data => { if (data.serverRoot) setServerRoot(data.serverRoot); })
      .catch(() => setMessage('Error al cargar la configuración.'));
  }, []);

  const saveSettings = async () => {
    try {
      const res = await fetchWithToken(`${API_BASE}/api/settings`, {
        method: 'POST',
        body: JSON.stringify({ serverRoot }),
      });
      const data = await res.json();
      setMessage(res.ok ? 'Configuración guardada correctamente.' : `Error: ${data.error}`);
    } catch {
      setMessage('Error al guardar la configuración.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 rounded-lg">
      <h1 className="text-2xl font-bold mb-4">Configuración</h1>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="server-root-input"
            className="block mb-1 font-medium"
          >
            Directorio raíz de servidores
          </label>
          <input
            id="server-root-input"
            type="text"
            value={serverRoot}
            onChange={(e) => setServerRoot(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border transition-colors ${darkMode
              ? 'bg-gray-800 text-white border-gray-700'
              : 'bg-white text-gray-900 border-gray-300'
            }`}
          />
        </div>
        <button
          onClick={saveSettings}
          className={`px-4 py-2 rounded-lg transition-colors ${darkMode
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-purple-500 text-white hover:bg-purple-600'
          }`}
        >
          Guardar
        </button>
        {message && (
          <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>{message}</p>
        )}
      </div>
    </div>
  );
}
