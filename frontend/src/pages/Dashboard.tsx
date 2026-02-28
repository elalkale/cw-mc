import React, { useState, useRef } from "react";
import { LayoutGrid, List, Upload, X, Server, PackageOpen, Zap } from "lucide-react";
import ServerCard from "../components/ServerCard";
import CreateServerModal from "../components/CreateServerModal";
import { API_BASE, fetchWithToken } from "../lib/api";

function InstallingCard({ info, darkMode }) {
  const done  = info.status === 'done';
  const error = info.status === 'error';

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col shadow-lg ${darkMode
      ? 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/30'
      : 'bg-gradient-to-br from-white to-purple-50/70 border-purple-300/60'
    }`}>
      <div className="h-[72px] bg-gray-900/50 flex items-center justify-center relative overflow-hidden flex-shrink-0">
        {info.logo
          ? <img src={info.logo} alt="" className="w-full h-full object-cover opacity-40" />
          : <div className={`w-full h-full ${darkMode ? "bg-gradient-to-br from-purple-900/70 via-indigo-900/40 to-pink-900/60" : "bg-gradient-to-br from-purple-200/80 via-indigo-100 to-pink-200/80"}`} />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {!done && !error && <span className="w-6 h-6 rounded-full border-[3px] border-t-transparent border-purple-400 animate-spin" />}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm border ${
            done  ? 'bg-green-500/20 border-green-400/40 text-green-300'
            : error ? 'bg-red-500/20 border-red-400/40 text-red-300'
            : 'bg-purple-500/20 border-purple-400/40 text-purple-300'
          }`}>
            {done ? '✓ Instalado' : error ? 'Error' : 'Instalando...'}
          </span>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3 flex flex-col gap-1">
        <p className={`font-bold text-sm leading-tight line-clamp-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {info.serverName}
        </p>
        <p className={`text-xs line-clamp-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{info.modName}</p>
        {error && info.error && <p className="text-xs text-red-400 mt-1 line-clamp-2">{info.error}</p>}
      </div>
    </div>
  );
}

export default function Dashboard({ servers, startServer, stopServer, darkMode, installations = {} }: { servers: any; startServer: any; stopServer: any; darkMode: any; installations?: Record<string, any> }) {
  const [viewMode, setViewMode] = useState("grid");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName,  setUploadName]  = useState('');
  const [uploadFile,  setUploadFile]  = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const openUploadModal = () => { setUploadName(''); setUploadFile(null); setUploadError(''); setShowUploadModal(true); };
  const closeUploadModal = () => { if (uploading) return; setShowUploadModal(false); };

  const openCreateModal = () => { setShowCreateModal(true); };
  const closeCreateModal = () => { setShowCreateModal(false); };
  const onServerCreated = () => {
    closeCreateModal();
    // El Dashboard se actualizará mediante polling o refresh desde el Layout
  };

  const handleUpload = async () => {
    if (!uploadName.trim()) { setUploadError('El nombre no puede estar vacío'); return; }
    if (!uploadFile)         { setUploadError('Selecciona un archivo ZIP'); return; }
    setUploading(true); setUploadError('');
    try {
      const form = new FormData();
      form.append('serverName', uploadName.trim());
      form.append('file', uploadFile);
      const res  = await fetchWithToken(`${API_BASE}/api/servers/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir el servidor');
      setShowUploadModal(false);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const activeInstalls  = Object.entries(installations).filter(([, i]) => i.status === 'installing' || i.status === 'error');
  const installingNames = new Set(activeInstalls.map(([, i]) => i.serverName));
  const serverEntries   = (Object.entries(servers) as [string, any][]).filter(([name]) => !installingNames.has(name));

  const totalServers  = serverEntries.length + activeInstalls.length;
  const runningCount  = serverEntries.filter(([, d]) => (d as any).running).length;
  const isEmpty       = serverEntries.length === 0 && activeInstalls.length === 0;

  const bg = darkMode
    ? "bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]"
    : "bg-[radial-gradient(ellipse_at_top,_#ede9fe_0%,_#f9f9ff_55%,_#faf5ff_100%)]";

  return (
    <div className={`min-h-screen relative transition-colors duration-300 ${bg}`}>

      {/* Blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 ${darkMode ? "bg-purple-600" : "bg-purple-400"}`} />
        <div className={`absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 ${darkMode ? "bg-pink-600" : "bg-pink-400"}`} style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-16">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            {/* Badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${darkMode ? "bg-purple-500/10 border-purple-500/25 text-purple-300" : "bg-purple-100 border-purple-300/60 text-purple-700"}`}>
              <Server size={11} />
              Panel de control
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
              Mis Servidores
            </h1>
            <p className={`text-sm ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
              Gestiona e inicia tus servidores de Minecraft
            </p>
          </div>

          {/* Stats + acciones */}
          <div className="flex flex-col items-end gap-3">
            {/* Stats pills */}
            {totalServers > 0 && (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${darkMode ? "bg-gray-800/80 border-gray-700 text-gray-400" : "bg-white border-gray-200 text-gray-500 shadow-sm"}`}>
                  <Server size={11} />
                  {totalServers} {totalServers === 1 ? 'servidor' : 'servidores'}
                </span>
                {runningCount > 0 && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${darkMode ? "bg-green-500/10 border-green-500/25 text-green-400" : "bg-green-50 border-green-200 text-green-700"}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {runningCount} activo{runningCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Botones */}
            <div className="flex items-center gap-2">
              <button
                onClick={openCreateModal}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
                  ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50'
                  : 'border-purple-400/60 text-purple-700 hover:bg-purple-50 hover:border-purple-500/70'
                }`}
              >
                <Zap size={14} />
                <span className="hidden sm:inline">Crear Servidor</span>
              </button>
              <button
                onClick={openUploadModal}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
                  ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50'
                  : 'border-purple-400/60 text-purple-700 hover:bg-purple-50 hover:border-purple-500/70'
                }`}
              >
                <Upload size={14} />
                <span className="hidden sm:inline">Subir Servidor</span>
              </button>

              <div
                className={`flex gap-1 p-1 rounded-xl border transition-colors ${darkMode ? "bg-gray-800/60 border-gray-700/60" : "bg-white border-gray-200 shadow-sm"}`}
                role="group"
                aria-label="Modo de vista"
              >
                {[
                  { mode: 'grid', Icon: LayoutGrid, label: 'Cuadrícula' },
                  { mode: 'list', Icon: List,        label: 'Lista'      },
                ].map(({ mode, Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-label={`Vista ${label}`}
                    aria-pressed={viewMode === mode}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-sm font-medium ${viewMode === mode
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm"
                      : darkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Contenido ──────────────────────────────────────────────────────── */}
        {isEmpty ? (
          <div className={`flex flex-col items-center justify-center py-24 gap-4 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${darkMode ? "bg-gray-800/60 border border-gray-700/60" : "bg-white border border-gray-200 shadow-sm"}`}>
              <PackageOpen size={28} className={darkMode ? "text-gray-600" : "text-gray-400"} />
            </div>
            <div className="text-center">
              <p className={`font-semibold text-sm mb-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Sin servidores</p>
              <p className="text-xs">Sube un ZIP o instala un modpack desde el catálogo.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-colors"
              >
                <Zap size={14} /> Crear servidor
              </button>
              <button
                onClick={openUploadModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              >
                <Upload size={14} /> Subir servidor
              </button>
            </div>
          </div>
        ) : (
          <div
            className={viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              : "flex flex-col gap-4"
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
                darkMode={darkMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal subir servidor ─────────────────────────────────────────────── */}
      {showUploadModal && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={closeUploadModal} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
            <div
              className={`w-full max-w-md rounded-2xl shadow-2xl border pointer-events-auto ${darkMode
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30'
                : 'bg-white border-purple-200/70'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
                    <Upload size={14} className="text-purple-400" />
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Subir Servidor</h3>
                </div>
                <button onClick={closeUploadModal} disabled={uploading} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={15} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Nombre del servidor</label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUpload(); }}
                    placeholder="mi-servidor"
                    disabled={uploading}
                    className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode
                      ? 'bg-gray-950 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
                      : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
                    } disabled:opacity-50`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Archivo ZIP del servidor</label>
                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`w-full px-4 py-4 rounded-xl text-sm border-2 border-dashed cursor-pointer transition-colors text-center ${darkMode
                      ? 'border-gray-700 hover:border-purple-500/50 text-gray-500 hover:text-gray-400'
                      : 'border-gray-200 hover:border-purple-400 text-gray-400 hover:text-gray-600'
                    } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {uploadFile
                      ? <span className={`font-medium ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>{uploadFile.name}</span>
                      : <><Upload size={16} className="inline mr-2 opacity-50" />Haz clic para seleccionar un .zip</>
                    }
                  </div>
                  <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={e => setUploadFile(e.target.files[0] || null)} />
                </div>
                {uploadError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{uploadError}</p>
                )}
              </div>

              <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button onClick={closeUploadModal} disabled={uploading} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} disabled:opacity-50`}>
                  Cancelar
                </button>
                <button onClick={handleUpload} disabled={uploading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-60">
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

      {/* ── Modal crear servidor ─────────────────────────────────────────── */}
      <CreateServerModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        darkMode={darkMode}
        onServerCreated={onServerCreated}
      />
    </div>
  );
}
