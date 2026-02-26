import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Package, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api.js';
import DescriptionHTML from './DescriptionHTML.jsx';
import Lightbox from './Lightbox.jsx';

const LOADER_NAMES = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };
const SORT_OPTIONS = [
  { value: '2', label: 'Popularidad' },
  { value: '6', label: 'Descargas' },
  { value: '3', label: 'Actualización' },
  { value: '4', label: 'Nombre' },
];
const PAGE_SIZE = 20;

function formatDownloads(n) {
  if (!n) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}

/** Devuelve el fileId más compatible dado los filtros activos */
function pickFileId(mod, version, loader) {
  const indexes = mod.latestFilesIndexes;
  if (!indexes?.length) return null;

  const loaderNum = loader ? Number(loader) : null;

  // 1. versión exacta + loader exacto
  let match = indexes.find(f =>
    (!version || f.gameVersion === version) &&
    (!loaderNum || f.modLoader === loaderNum)
  );
  if (match) return match.fileId;

  // 2. versión exacta (cualquier loader)
  if (version) {
    match = indexes.find(f => f.gameVersion === version);
    if (match) return match.fileId;
  }

  // 3. loader exacto (cualquier versión)
  if (loaderNum) {
    match = indexes.find(f => f.modLoader === loaderNum);
    if (match) return match.fileId;
  }

  // 4. cualquier archivo disponible
  return indexes[0]?.fileId ?? null;
}

// ── Tarjeta de mod ────────────────────────────────────────────────────────────
function ModCard({ mod, darkMode, installing, installed, error, onInstall, onDetail, version, loader }) {
  const fileId = pickFileId(mod, version, loader);
  const compatible = fileId !== null;

  const availableLoaders = [...new Set((mod.latestFilesIndexes || []).map(f => f.modLoader).filter(Boolean))];

  return (
    <div
      onClick={onDetail}
      className={`rounded-2xl border flex flex-col transition-colors cursor-pointer ${darkMode
        ? 'bg-gray-800/60 border-gray-700/40 hover:border-purple-500/50'
        : 'bg-white border-gray-100 hover:border-purple-300 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Cuerpo */}
      <div className="p-3 flex items-start gap-3 flex-1">
        {mod.logo?.thumbnailUrl ? (
          <img
            src={mod.logo.thumbnailUrl}
            alt=""
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-black/10"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {mod.name}
          </p>
          <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {mod.summary}
          </p>
          {availableLoaders.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {availableLoaders.slice(0, 3).map(l => LOADER_NAMES[l] && (
                <span key={l} className={`text-[10px] px-1.5 py-px rounded-full font-medium border ${darkMode
                  ? 'bg-gray-700/60 border-gray-600/60 text-gray-400'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}>
                  {LOADER_NAMES[l]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 border-t ${darkMode ? 'border-gray-700/40' : 'border-gray-100'}`}
        onClick={e => e.stopPropagation()}
      >
        <span className={`text-xs flex items-center gap-1 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
          <Download size={10} />
          {formatDownloads(mod.downloadCount)}
        </span>

        {error ? (
          <span className="text-[11px] text-red-400 truncate max-w-[130px]" title={error}>{error}</span>
        ) : installed ? (
          <span className="text-xs text-green-400 font-medium">✓ Instalado</span>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing || !compatible}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed ${
              !compatible
                ? darkMode ? 'border border-gray-700/60 text-gray-600' : 'border border-gray-200 text-gray-400'
                : installing
                  ? 'bg-purple-600/60 text-white/70 cursor-wait'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
            }`}
          >
            {installing
              ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" />
              : <Download size={11} />}
            {!compatible ? 'Sin versión' : installing ? 'Instalando...' : 'Instalar'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Vista de detalle de mod ───────────────────────────────────────────────────
function ModDetailView({ mod, darkMode, installing, installed, installError, onInstall, onBack, version, loader }) {
  const [detailTab, setDetailTab] = useState('desc');
  const [description, setDescription] = useState('');
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const fileId = pickFileId(mod, version, loader);
  const compatible = fileId !== null;

  useEffect(() => {
    setLoadingDesc(true);
    fetchWithToken(`${API_BASE}/api/curseforge/mod/${mod.id}/description`)
      .then(r => r.json())
      .then(d => setDescription(d.data || ''))
      .catch(console.error)
      .finally(() => setLoadingDesc(false));
  }, [mod.id]);

  useEffect(() => {
    if (detailTab !== 'versions') return;
    setLoadingFiles(true);
    fetchWithToken(`${API_BASE}/api/curseforge/mod/${mod.id}/files?pageSize=50`)
      .then(r => r.json())
      .then(d => setFiles(d.data || []))
      .catch(console.error)
      .finally(() => setLoadingFiles(false));
  }, [mod.id, detailTab]);

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} darkMode={darkMode} />}

      {/* Back button row */}
      <div className={`flex items-center gap-2 px-5 py-3 border-b flex-shrink-0 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          <ChevronLeft size={16} />
          Volver al catálogo
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Hero */}
        <div className={`relative px-5 py-5 border-b ${darkMode ? 'border-gray-700/60 bg-gray-800/30' : 'border-gray-200 bg-gray-50/60'}`}>
          <div className="flex items-start gap-4">
            {/* Logo */}
            {mod.logo?.url ? (
              <img
                src={mod.logo.url}
                alt=""
                className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-black/10 shadow"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center flex-shrink-0">
                <Package size={28} className="text-white" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2 className={`text-lg font-bold leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {mod.name}
              </h2>
              {mod.authors?.length > 0 && (
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  por {mod.authors.map(a => a.name).join(', ')}
                </p>
              )}
              <p className={`text-sm mt-2 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {mod.summary}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className={`text-xs flex items-center gap-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Download size={11} />
                  {formatDownloads(mod.downloadCount)} descargas
                </span>
                {[...new Set((mod.latestFilesIndexes || []).map(f => f.modLoader).filter(Boolean))].slice(0, 4).map(l => LOADER_NAMES[l] && (
                  <span key={l} className={`text-[10px] px-1.5 py-px rounded-full font-medium border ${darkMode
                    ? 'bg-gray-700/60 border-gray-600/60 text-gray-400'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}>
                    {LOADER_NAMES[l]}
                  </span>
                ))}
              </div>
            </div>

            {/* Install button */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {installed ? (
                <span className="text-sm text-green-400 font-medium flex items-center gap-1">
                  ✓ Instalado
                </span>
              ) : (
                <>
                  <button
                    onClick={() => onInstall(fileId)}
                    disabled={!!installing || !compatible}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed ${
                      !compatible
                        ? darkMode ? 'border border-gray-700 text-gray-600' : 'border border-gray-200 text-gray-400'
                        : installing
                          ? 'bg-purple-600/60 text-white/70 cursor-wait'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                    }`}
                  >
                    {installing
                      ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
                      : <Download size={14} />}
                    {!compatible ? 'Sin versión' : installing ? 'Instalando...' : 'Instalar'}
                  </button>
                  {installError && (
                    <p className="text-[11px] text-red-400 max-w-[160px] text-right">{installError}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 px-5 py-2 border-b flex-shrink-0 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
          {[['desc', 'Descripción'], ['versions', 'Versiones'], ['screenshots', 'Capturas']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDetailTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                detailTab === key
                  ? darkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                  : darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {key === 'screenshots' && mod.screenshots?.length > 0 && (
                <span className={`ml-1 text-[10px] ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                  ({mod.screenshots.length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">

          {/* Descripción */}
          {detailTab === 'desc' && (
            loadingDesc ? (
              <div className={`h-32 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
            ) : description ? (
              <div className={`rounded-xl p-4 ${darkMode ? 'bg-gray-800/60 border border-gray-700/40' : 'bg-purple-50 border border-purple-200'}`}>
                <DescriptionHTML html={description} darkMode={darkMode} />
              </div>
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                Sin descripción disponible.
              </p>
            )
          )}

          {/* Versiones */}
          {detailTab === 'versions' && (
            loadingFiles ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`h-14 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
                ))}
              </div>
            ) : files.length === 0 ? (
              <p className={`text-sm ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                No hay archivos disponibles.
              </p>
            ) : (
              <div className="space-y-2">
                {files.map(file => (
                  <div
                    key={file.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border gap-3 ${darkMode ? 'bg-gray-800/40 border-gray-700/40' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {file.displayName || file.fileName}
                      </p>
                      <p className={`text-xs mt-0.5 truncate ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                        {file.gameVersions?.slice(0, 4).join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={() => onInstall(file.id)}
                      disabled={!!installing}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all disabled:cursor-not-allowed ${
                        installing
                          ? 'bg-purple-600/60 text-white/70 cursor-wait'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                      }`}
                    >
                      {installing
                        ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" />
                        : <Download size={10} />}
                      Instalar
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Capturas */}
          {detailTab === 'screenshots' && (
            mod.screenshots?.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {mod.screenshots.map(ss => (
                  <img
                    key={ss.id}
                    src={ss.thumbnailUrl || ss.url}
                    alt={ss.title || ''}
                    className="w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity object-cover aspect-video"
                    onClick={() => setLightboxSrc(ss.url)}
                  />
                ))}
              </div>
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                No hay capturas disponibles.
              </p>
            )
          )}

        </div>
      </div>
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ModCatalog({ server, data, darkMode, onClose, onModInstalled, installedModIds }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [version, setVersion] = useState(() => {
    if (data.modpack?.gameVersions?.length) return data.modpack.gameVersions[0];
    const m = (data.version || '').match(/(\d+\.\d+(?:\.\d+)?)/);
    return m ? m[1] : '';
  });
  const [loader, setLoader] = useState(
    () => data.modpack?.modLoaders?.[0]?.toString() || ''
  );
  const [sortField, setSortField] = useState('2');
  const [page, setPage] = useState(0);
  const [mods, setMods] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(null);       // { modId, fileId } | null
  const [installErrors, setInstallErrors] = useState({});   // modId → mensaje
  const [installedIds, setInstalledIds] = useState(new Set());
  const [selectedMod, setSelectedMod] = useState(null);     // mod object for detail view
  const [depsNotice, setDepsNotice] = useState(null);        // { deps, failedDeps } | null

  const debounceRef = useRef(null);

  // Debounce búsqueda
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset página al cambiar filtros
  useEffect(() => { setPage(0); }, [version, loader, sortField]);

  // Fetch mods
  useEffect(() => {
    if (selectedMod) return; // No re-fetch mientras se ve el detalle
    const params = new URLSearchParams({
      index: page * PAGE_SIZE,
      pageSize: PAGE_SIZE,
      sortField,
      sortOrder: 'desc',
    });
    if (debouncedSearch) params.set('searchFilter', debouncedSearch);
    if (version) params.set('gameVersion', version);
    if (loader) params.set('modLoaderType', loader);

    setLoading(true);
    fetchWithToken(`${API_BASE}/api/curseforge/mods/search?${params}`)
      .then(r => r.json())
      .then(d => {
        setMods(d.data || []);
        setTotalCount(d.pagination?.totalCount ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, version, loader, sortField, page, selectedMod]);

  const isInstalled = (modId) =>
    installedIds.has(modId) || installedModIds?.has(modId);

  const installMod = async (mod, fileId) => {
    if (!fileId) return;

    setInstalling({ modId: mod.id, fileId });
    setInstallErrors(prev => { const n = { ...prev }; delete n[mod.id]; return n; });
    setDepsNotice(null);
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/servers/${encodeURIComponent(server)}/mods/install`,
        { method: 'POST', body: JSON.stringify({ modId: mod.id, fileId }) }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al instalar');
      setInstalledIds(prev => new Set([...prev, mod.id, ...(d.deps || []).map(dep => dep.modId)]));
      if ((d.deps?.length ?? 0) > 0 || (d.failedDeps?.length ?? 0) > 0) {
        setDepsNotice({ deps: d.deps || [], failedDeps: d.failedDeps || [] });
      }
      onModInstalled?.();
    } catch (err) {
      setInstallErrors(prev => ({ ...prev, [mod.id]: err.message }));
    } finally {
      setInstalling(null);
    }
  };

  const totalPages = Math.ceil(Math.min(totalCount, 10000) / PAGE_SIZE);

  const inputCls = `px-3 py-2 rounded-xl text-sm border focus:outline-none transition-colors ${darkMode
    ? 'bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
  }`;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-3 md:p-6">
        <div
          className={`w-full max-w-5xl h-full max-h-[92vh] rounded-2xl shadow-2xl border pointer-events-auto flex flex-col ${darkMode
            ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30'
            : 'bg-white border-purple-200/70'
          }`}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Header ── */}
          <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
                <Package size={14} className="text-purple-400" />
              </div>
              <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Catálogo de Mods — <span className="text-purple-400">{server}</span>
              </h3>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
              aria-label="Cerrar catálogo"
            >
              <X size={15} />
            </button>
          </div>

          {/* ── Detalle de mod ── */}
          {selectedMod ? (
            <ModDetailView
              mod={selectedMod}
              darkMode={darkMode}
              installing={installing?.modId === selectedMod.id}
              installed={isInstalled(selectedMod.id)}
              installError={installErrors[selectedMod.id]}
              onInstall={(fileId) => installMod(selectedMod, fileId)}
              onBack={() => setSelectedMod(null)}
              version={version}
              loader={loader}
            />
          ) : (
            <>
              {/* ── Filtros ── */}
              <div className={`px-4 py-3 border-b flex-shrink-0 flex flex-wrap gap-2 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                {/* Búsqueda */}
                <div className="relative flex-1 min-w-44">
                  <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar mod..."
                    className={`w-full pl-8 pr-3 ${inputCls}`}
                  />
                </div>

                {/* Versión */}
                <input
                  type="text"
                  value={version}
                  onChange={e => { setVersion(e.target.value); setPage(0); }}
                  placeholder="1.20.1"
                  className={`w-28 ${inputCls}`}
                />

                {/* Loader */}
                <select
                  value={loader}
                  onChange={e => { setLoader(e.target.value); setPage(0); }}
                  className={inputCls}
                >
                  <option value="">Todos los loaders</option>
                  <option value="1">Forge</option>
                  <option value="4">Fabric</option>
                  <option value="5">Quilt</option>
                  <option value="6">NeoForge</option>
                </select>

                {/* Orden */}
                <select
                  value={sortField}
                  onChange={e => { setSortField(e.target.value); setPage(0); }}
                  className={inputCls}
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* ── Aviso dependencias instaladas ── */}
              {depsNotice && (
                <div className={`mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-3 border ${darkMode ? 'bg-indigo-500/10 border-indigo-500/25' : 'bg-indigo-50 border-indigo-200'}`}>
                  <div className="flex-1 min-w-0">
                    {depsNotice.deps.length > 0 && (
                      <p className={`text-xs font-medium ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                        Dependencias instaladas automáticamente: {depsNotice.deps.map(d => d.name).join(', ')}
                      </p>
                    )}
                    {depsNotice.failedDeps.length > 0 && (
                      <p className={`text-xs mt-0.5 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                        No se pudieron instalar: {depsNotice.failedDeps.map(d => `mod ${d.modId}`).join(', ')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setDepsNotice(null)} className={`p-0.5 rounded flex-shrink-0 ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* ── Contenido ── */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className={`h-36 rounded-2xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
                    ))}
                  </div>
                ) : mods.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center gap-3 py-16 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    <Package size={40} className="opacity-25" />
                    <p className="text-sm">No se encontraron mods</p>
                    {(version || loader) && (
                      <button
                        onClick={() => { setVersion(''); setLoader(''); }}
                        className="text-xs text-purple-400 hover:text-purple-300 underline"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mods.map(mod => (
                      <ModCard
                        key={mod.id}
                        mod={mod}
                        darkMode={darkMode}
                        installing={installing?.modId === mod.id}
                        installed={isInstalled(mod.id)}
                        error={installErrors[mod.id]}
                        onInstall={() => installMod(mod, pickFileId(mod, version, loader))}
                        onDetail={() => setSelectedMod(mod)}
                        version={version}
                        loader={loader}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Paginación ── */}
              <div className={`flex items-center justify-between px-5 py-3 border-t flex-shrink-0 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {loading ? (
                    <RefreshCw size={11} className="animate-spin inline mr-1" />
                  ) : null}
                  {totalCount > 0 ? `${totalCount.toLocaleString()} mods` : ''}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className={`text-xs font-medium min-w-[60px] text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1 || loading}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
