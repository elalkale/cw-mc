import React, { useState, useRef } from "react";
import { LayoutGrid, List, Upload, X } from "lucide-react";
import ServerCard from "../components/ServerCard.jsx";
import { API_BASE, fetchWithToken } from "../lib/api.js";

function InstallingCard({ info, darkMode }) {
  const done = info.status === 'done';
  const error = info.status === 'error';
  const border = darkMode
    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
    : 'bg-gradient-to-br from-white to-gray-100 border-purple-400/40';

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col shadow-lg ${border}`}>
      {/* Thumbnail / logo */}
      <div className="h-28 bg-gray-900/50 flex items-center justify-center relative overflow-hidden">
        {info.logo ? (
          <img src={info.logo} alt="" className="w-full h-full object-cover opacity-40" />
        ) : (
          <span className="text-5xl opacity-20">📦</span>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {!done && !error && (
            <span className="w-8 h-8 rounded-full border-4 border-t-transparent border-purple-400 animate-spin" />
          )}
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            done  ? 'bg-green-600/80 text-white'
            : error ? 'bg-red-600/80 text-white'
            : 'bg-purple-600/80 text-white'
          }`}>
            {done ? '✓ Instalado' : error ? 'Error' : 'Instalando...'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1">
        <p className={`font-bold text-sm leading-tight line-clamp-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {info.serverName}
        </p>
        <p className={`text-xs line-clamp-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {info.modName}
        </p>
        {error && info.error && (
          <p className="text-xs text-red-400 mt-1 line-clamp-2">{info.error}</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({
  servers,
  startServer,
  stopServer,
  darkMode,
  installations = {},
}) {
  const [viewMode, setViewMode] = useState("grid");

  // ── Upload server modal ──────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const openUploadModal = () => {
    setUploadName('');
    setUploadFile(null);
    setUploadError('');
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    if (uploading) return;
    setShowUploadModal(false);
  };

  const handleUpload = async () => {
    if (!uploadName.trim()) { setUploadError('El nombre no puede estar vacío'); return; }
    if (!uploadFile) { setUploadError('Selecciona un archivo ZIP'); return; }
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('serverName', uploadName.trim());
      form.append('file', uploadFile);
      const res = await fetchWithToken(`${API_BASE}/api/servers/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir el servidor');
      setShowUploadModal(false);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };
  const activeInstalls = Object.entries(installations).filter(
    ([, info]) => info.status === 'installing' || info.status === 'error'
  );
  const installingNames = new Set(activeInstalls.map(([, info]) => info.serverName));
  // Ocultar servidores que aún están instalándose para no mostrar ambas cards a la vez
  const serverEntries = Object.entries(servers).filter(([name]) => !installingNames.has(name));

  return (
    <div
      className={`max-w-7xl mx-auto mt-2 md:mt-6 px-4 md:px-6 transition-colors duration-300 py-4 rounded-lg ${darkMode ? "bg-gray-900" : "bg-gray-50"
        }`}
    >
      <div className="flex items-center justify-between mb-8 flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Panel de Servidores
          </h1>
          <p
            className={`text-sm md:text-base transition-colors ${darkMode ? "text-gray-400" : "text-gray-700"
              }`}
          >
            Gestiona tus servidores de Minecraft
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Botón subir servidor */}
          <button
            onClick={openUploadModal}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
              ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50'
              : 'border-purple-400/60 text-purple-700 hover:bg-purple-50 hover:border-purple-500/70'
            }`}
          >
            <Upload size={15} />
            <span className="hidden sm:inline">Subir Servidor</span>
          </button>

          {/* Selector de vista con role="group" (WCAG 4.1.2) */}
          <div
            className={`flex gap-2 p-1 rounded-lg backdrop-blur-sm border transition-colors ${darkMode
              ? "bg-gray-800/50 border-purple-500/20"
              : "bg-gray-200 border-purple-400/50"
              }`}
            role="group"
            aria-label="Modo de vista de servidores"
          >
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-2 rounded-md transition flex items-center gap-2 ${viewMode === "grid"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                : darkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-700 hover:text-gray-900"
                }`}
              aria-label="Ver servidores en vista cuadrícula"
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid size={18} aria-hidden="true" />
              <span className="hidden sm:inline text-sm">Grid</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 rounded-md transition flex items-center gap-2 ${viewMode === "list"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                : darkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-700 hover:text-gray-900"
                }`}
              aria-label="Ver servidores en vista lista"
              aria-pressed={viewMode === "list"}
            >
              <List size={18} aria-hidden="true" />
              <span className="hidden sm:inline text-sm">Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Estado vacío accesible con role="status" (WCAG 4.1.3) */}
      {serverEntries.length === 0 && activeInstalls.length === 0 ? (
        <div
          role="status"
          className={`text-center py-16 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
        >
          No hay servidores configurados.
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-2 px-3"
              : "flex flex-col gap-4 py-2 px-3"
          }
          aria-label="Lista de servidores"
        >
          {activeInstalls.map(([installId, info]) => (
            <InstallingCard key={installId} info={info} darkMode={darkMode} />
          ))}
          {serverEntries.map(([name, data]) => (
            <ServerCard
              key={name}
              server={name}
              data={data}
              onStart={startServer}
              onStop={stopServer}
              compact={viewMode === "list"}
              darkMode={darkMode}
            />
          ))}
        </div>
      )}
      {/* ── Modal subir servidor ──────────────────────────────────────────── */}
      {showUploadModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={closeUploadModal}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
            <div
              className={`w-full max-w-md rounded-2xl shadow-2xl border pointer-events-auto ${darkMode
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30'
                : 'bg-white border-purple-200/70'
              }`}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
                    <Upload size={14} className="text-purple-400" />
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Subir Servidor
                  </h3>
                </div>
                <button
                  onClick={closeUploadModal}
                  disabled={uploading}
                  className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Nombre del servidor
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    placeholder="mi-servidor"
                    disabled={uploading}
                    className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode
                      ? 'bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
                      : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
                    } disabled:opacity-50`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Archivo ZIP del servidor
                  </label>
                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`w-full px-3 py-3 rounded-xl text-sm border-2 border-dashed cursor-pointer transition-colors ${darkMode
                      ? 'border-gray-700 hover:border-purple-500/50 text-gray-500 hover:text-gray-400'
                      : 'border-gray-200 hover:border-purple-400 text-gray-400 hover:text-gray-600'
                    } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {uploadFile
                      ? <span className={darkMode ? 'text-purple-300' : 'text-purple-700'}>{uploadFile.name}</span>
                      : 'Haz clic para seleccionar un .zip'
                    }
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={e => setUploadFile(e.target.files[0] || null)}
                  />
                </div>
                {uploadError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button
                  onClick={closeUploadModal}
                  disabled={uploading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  } disabled:opacity-50`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {uploading
                    ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />Subiendo...</>
                    : <><Upload size={14} />Subir</>
                  }
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
