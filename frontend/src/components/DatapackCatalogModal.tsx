import React, { useState, useEffect } from 'react';
import { X, Database, Download, RefreshCw, CheckCircle, AlertCircle, Search, AlertTriangle } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api';
import knownLoaders from '../data/datapackLoaders.json';

const LOADER_NUM: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };

function mcVersionGte(version: string, min: string): boolean {
  const a = version.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av > bv;
  }
  return true;
}

interface Props {
  server: string;
  modLoader: string;
  mcVersion: string;
  darkMode: boolean;
  onClose: () => void;
  onInstalled: () => void;
  onIgnore?: () => void; // optional: show "ignore" footer for the suggestion flow
}

export default function DatapackCatalogModal({ server, modLoader, mcVersion, darkMode, onClose, onInstalled, onIgnore }: Props) {
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [confirmIgnore, setConfirmIgnore] = useState(false);
  const [serverModIds, setServerModIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchWithToken(`${API_BASE}/api/servers/${encodeURIComponent(server)}/mods`)
      .then(r => r.json())
      .then((data: any[]) => {
        const ids = new Set(data.filter(m => m.modId).map(m => m.modId as number));
        setServerModIds(ids);
      })
      .catch(() => {});
  }, [server]);

  const loaderKey = modLoader.toLowerCase();

  const compatible = knownLoaders.filter(l =>
    l.loaders.includes(loaderKey) &&
    mcVersionGte(mcVersion, l.minMcVersion)
  );

  const filtered = search.trim()
    ? compatible.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.description.toLowerCase().includes(search.toLowerCase())
      )
    : compatible;

  useEffect(() => {
    for (const entry of compatible) {
      if (!entry.curseforgeId) continue;
      fetchWithToken(`${API_BASE}/api/curseforge/mod/${entry.curseforgeId}`)
        .then(r => r.json())
        .then(data => {
          const logo = data?.data?.logo?.thumbnailUrl;
          if (logo) setLogos(prev => ({ ...prev, [entry.slug]: logo }));
        })
        .catch(() => {});
    }
  }, [mcVersion, modLoader]);

  async function handleInstall(entry: typeof knownLoaders[number]) {
    setInstalling(entry.slug);
    setErrors(prev => { const n = { ...prev }; delete n[entry.slug]; return n; });
    try {
      const loaderNum = LOADER_NUM[loaderKey];
      if (!entry.curseforgeId) throw new Error('ID de CurseForge no definido');

      const filesRes = await fetchWithToken(
        `${API_BASE}/api/curseforge/mod/${entry.curseforgeId}/files?pageSize=10${mcVersion ? `&gameVersion=${mcVersion}` : ''}${loaderNum ? `&modLoaderType=${loaderNum}` : ''}`
      );
      const filesData = await filesRes.json();
      const files: any[] = filesData?.data ?? [];
      if (files.length === 0) throw new Error('No hay archivos compatibles para esta versión');

      const res = await fetchWithToken(
        `${API_BASE}/api/servers/${encodeURIComponent(server)}/mods/install`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modId: entry.curseforgeId, fileId: files[0].id }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al instalar');

      setInstalled(prev => new Set([...prev, entry.slug]));
      onInstalled();
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [entry.slug]: err.message ?? 'Error desconocido' }));
    } finally {
      setInstalling(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
        <div
          className={`w-full max-w-2xl rounded-2xl shadow-2xl border pointer-events-auto flex flex-col ${
            darkMode
              ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30'
              : 'bg-white border-purple-200/70'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
                <Database size={14} className="text-purple-400" />
              </div>
              <div>
                <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Catálogo de Datapack Loaders
                </h3>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Para usar datapacks necesitas un mod. Elige uno compatible con {mcVersion} / {modLoader}.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
            >
              <X size={15} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrar..."
                className={`w-full pl-8 pr-3 py-2 rounded-lg text-sm border focus:outline-none transition-colors ${
                  darkMode
                    ? 'bg-gray-800/60 border-gray-700/50 text-gray-200 placeholder-gray-600 focus:border-purple-500/50'
                    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
                }`}
              />
            </div>
          </div>

          {/* Suggestion header (only in suggestion mode) */}
          {onIgnore && (
            <div className={`mx-4 mt-2 mb-1 flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs border ${darkMode ? 'bg-yellow-500/8 border-yellow-500/20 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
              <AlertTriangle size={13} className="shrink-0 mt-0.5 text-yellow-400" />
              Para usar datapacks fuera de un mundo necesitas instalar un mod loader de datapacks.
            </div>
          )}

          {/* Content */}
          <div className="px-4 pb-4 overflow-y-auto custom-scrollbar max-h-[55vh]">
            {filtered.length === 0 ? (
              <div className={`text-center py-10 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                No hay datapack loaders conocidos para {mcVersion} / {modLoader}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {filtered.map(entry => {
                  const alreadyOnServer = entry.curseforgeId ? serverModIds.has(entry.curseforgeId) : false;
                  const isInstalled = alreadyOnServer || installed.has(entry.slug);
                  const isInstalling = installing === entry.slug;
                  const error = errors[entry.slug];
                  const logo = logos[entry.slug];
                  const logoErr = logoErrors.has(entry.slug);
                  return (
                    <div
                      key={entry.slug}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                        darkMode
                          ? `border-gray-700/40 hover:border-gray-600/60 hover:bg-gray-700/10${alreadyOnServer ? ' border-green-500/20 bg-green-500/5' : ''}`
                          : `border-gray-100 hover:border-purple-200 hover:bg-purple-50/50${alreadyOnServer ? ' border-green-200 bg-green-50/50' : ''}`
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center overflow-hidden ${darkMode ? 'bg-purple-500/10' : 'bg-purple-100'}`}>
                        {logo && !logoErr
                          ? <img src={logo} alt="" onError={() => setLogoErrors(prev => new Set([...prev, entry.slug]))} className="w-full h-full object-cover" />
                          : <Database size={15} className="text-purple-400 opacity-60" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{entry.name}</p>
                          {alreadyOnServer && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${darkMode ? 'bg-green-500/15 text-green-400' : 'bg-green-100 text-green-600'}`}>
                              Instalado
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] mt-0.5 leading-snug ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{entry.description}</p>
                        {error && (
                          <p className="text-[11px] text-red-400 mt-0.5 flex items-center gap-1">
                            <AlertCircle size={10} /> {error}
                          </p>
                        )}
                        <span className={`text-[10px] mt-0.5 block ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                          Desde MC {entry.minMcVersion} · {entry.loaders.join(', ')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleInstall(entry)}
                        disabled={isInstalled || isInstalling || installing !== null}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                          isInstalled
                            ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                            : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 disabled:opacity-50'
                        }`}
                      >
                        {isInstalling ? (
                          <><RefreshCw size={11} className="animate-spin" /> Instalando...</>
                        ) : isInstalled ? (
                          <><CheckCircle size={11} /> Instalado</>
                        ) : (
                          <><Download size={11} /> Instalar</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with ignore option (suggestion mode only) */}
          {onIgnore && (
            <div className={`px-5 py-3 border-t flex items-center justify-end gap-2 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
              {confirmIgnore ? (
                <>
                  <span className={`text-xs mr-auto ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Este aviso no volverá a aparecer para este servidor.
                  </span>
                  <button
                    onClick={() => setConfirmIgnore(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${darkMode ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/40' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onIgnore}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${darkMode ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                  >
                    Confirmar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmIgnore(true)}
                  className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                >
                  Ya lo tengo / Ignorar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
