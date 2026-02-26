import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Package, Download, RefreshCw, ChevronLeft, ChevronRight, Tag, Layers, ArrowUpDown } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api';
import DescriptionHTML from './DescriptionHTML';
import Lightbox from './Lightbox';
import FilterSelect from './FilterSelect';

const LOADER_NAMES = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };
const KNOWN_LOADERS = new Set(['Forge', 'Fabric', 'Quilt', 'NeoForge']);

/** Extrae el loader de un archivo CF (gameVersions o sortableGameVersions para mods antiguos) */
function getFileLoader(file) {
  const fromGV = (file.gameVersions || []).find(v => KNOWN_LOADERS.has(v));
  if (fromGV) return fromGV;
  const fromSGV = (file.sortableGameVersions || []).find(sgv => KNOWN_LOADERS.has(sgv.gameVersionName));
  return fromSGV?.gameVersionName ?? null;
}

/** Formatea una fecha ISO de CF en formato corto (ej. "14 ene 2021") */
function formatFileDate(isoDate) {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}
const SORT_OPTIONS = [
  { value: '2', label: 'Popularidad' },
  { value: '6', label: 'Descargas' },
  { value: '3', label: 'Actualización' },
  { value: '4', label: 'Nombre' },
];
const MC_VERSION_OPTIONS = [
  { value: '', label: 'Todas las versiones' },
  ...[
    // 1.21.x
    '1.21.4','1.21.3','1.21.2','1.21.1','1.21',
    // 1.20.x
    '1.20.6','1.20.5','1.20.4','1.20.3','1.20.2','1.20.1','1.20',
    // 1.19.x
    '1.19.4','1.19.3','1.19.2','1.19.1','1.19',
    // 1.18.x
    '1.18.2','1.18.1','1.18',
    // 1.17.x
    '1.17.1','1.17',
    // 1.16.x
    '1.16.5','1.16.4','1.16.3','1.16.2','1.16.1','1.16',
    // 1.15.x
    '1.15.2','1.15.1','1.15',
    // 1.14.x
    '1.14.4','1.14.3','1.14.2','1.14.1','1.14',
    // 1.13.x
    '1.13.2','1.13.1','1.13',
    // 1.12.x
    '1.12.2','1.12.1','1.12',
    // 1.11.x
    '1.11.2','1.11',
    // 1.10.x
    '1.10.2','1.10',
    // 1.9.x
    '1.9.4','1.9',
    // 1.8.x
    '1.8.9','1.8.8','1.8',
    // 1.7.x
    '1.7.10','1.7.2',
    // 1.6.x
    '1.6.4','1.6.2',
    // 1.5.x
    '1.5.2','1.5',
    // 1.4.x
    '1.4.7','1.4.2',
    // 1.3.x
    '1.3.2',
    // 1.2.x
    '1.2.5',
    // Legacy
    '1.1','1.0',
  ].map(v => ({ value: v, label: v })),
];
const CATALOG_LOADER_OPTIONS = [
  { value: '', label: 'Todos los loaders' },
  ...Object.entries(LOADER_NAMES).map(([k, v]) => ({ value: k, label: v })),
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

  const availableLoaders: number[] = [...new Set((mod.latestFilesIndexes || []).map((f: any) => f.modLoader as number))].filter(Boolean) as number[];

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
function ModDetailView({ mod, darkMode, installing, installed, installError, onInstall, onBack, version, loader, depsNotice, onClearDeps }) {
  const [detailTab, setDetailTab] = useState('desc');
  const [description, setDescription] = useState('');
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [versionFilter, setVersionFilter] = useState('');
  const [loaderFilter, setLoaderFilter] = useState('');
  const [filesPage, setFilesPage] = useState(0);
  const FILES_PER_PAGE = 15;

  const fileId = pickFileId(mod, version, loader);
  const compatible = fileId !== null;

  // Un archivo se puede instalar solo si es compatible con el modpack
  const isInstallable = (file) => {
    const gv = file.gameVersions || [];
    if (version && !gv.includes(version)) return false;
    if (loader && LOADER_NAMES[Number(loader)] && !gv.includes(LOADER_NAMES[Number(loader)])) return false;
    return true;
  };

  // Filtro de visualización (no afecta a qué se puede instalar)
  const matchesFilter = (file) => {
    const gv = file.gameVersions || [];
    if (versionFilter && !gv.includes(versionFilter)) return false;
    if (loaderFilter && LOADER_NAMES[Number(loaderFilter)] && !gv.includes(LOADER_NAMES[Number(loaderFilter)])) return false;
    return true;
  };

  const filteredFiles = files.filter(matchesFilter);
  const filesTotalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE);
  const pagedFiles = filteredFiles.slice(filesPage * FILES_PER_PAGE, (filesPage + 1) * FILES_PER_PAGE);

  // Reset página cuando cambian los filtros
  useEffect(() => { setFilesPage(0); }, [versionFilter, loaderFilter]);

  // Opciones de versión derivadas de los archivos cargados
  const versionOptions = useMemo(() => {
    const versions = [...new Set(
      files.flatMap(f => f.gameVersions || []).filter(v => /^\d+\.\d+/.test(v))
    )].sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      return 0;
    });
    return [{ value: '', label: 'Todas las versiones' }, ...versions.map(v => ({ value: v, label: v }))];
  }, [files]);

  // Opciones de loader derivadas de los archivos cargados
  const loaderOptions = useMemo(() => {
    const present = new Set(
      files.flatMap(f => f.gameVersions || [])
        .map(v => Object.entries(LOADER_NAMES).find(([, name]) => name === v)?.[0])
        .filter(Boolean)
    );
    return [
      { value: '', label: 'Todos los loaders' },
      ...Object.entries(LOADER_NAMES)
        .filter(([k]) => present.has(k))
        .map(([k, v]) => ({ value: k, label: v })),
    ];
  }, [files]);

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
    const PAGE = 50;
    fetchWithToken(`${API_BASE}/api/curseforge/mod/${mod.id}/files?pageSize=${PAGE}&index=0`)
      .then(r => r.json())
      .then(async d => {
        const first = d.data || [];
        const total = d.pagination?.totalCount ?? first.length;
        // Obtener el resto de páginas en paralelo
        let all = first;
        if (total > PAGE) {
          const extraPages = Math.ceil((total - PAGE) / PAGE);
          const results = await Promise.all(
            Array.from({ length: extraPages }, (_, i) =>
              fetchWithToken(`${API_BASE}/api/curseforge/mod/${mod.id}/files?pageSize=${PAGE}&index=${(i + 1) * PAGE}`)
                .then(r => r.json())
                .then(d2 => d2.data || [])
                .catch(() => [])
            )
          );
          all = [...first, ...results.flat()];
        }
        setFiles(all);
        // Pre-seleccionar versión y loader del modpack solo si existen en los archivos cargados
        const allGV = new Set(all.flatMap(f => f.gameVersions || []));
        setVersionFilter(version && allGV.has(version) ? version : '');
        setLoaderFilter(loader && LOADER_NAMES[Number(loader)] && allGV.has(LOADER_NAMES[Number(loader)]) ? String(loader) : '');
      })
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

      {/* Aviso dependencias */}
      {depsNotice && (
        <div className={`mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-3 border flex-shrink-0 ${darkMode ? 'bg-indigo-500/10 border-indigo-500/25' : 'bg-indigo-50 border-indigo-200'}`}>
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
          <button onClick={onClearDeps} className={`p-0.5 rounded flex-shrink-0 ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
            <X size={13} />
          </button>
        </div>
      )}

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
                {([...new Set((mod.latestFilesIndexes || []).map((f: any) => f.modLoader as number))].filter(Boolean) as number[]).slice(0, 4).map(l => LOADER_NAMES[l] && (
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
            <>
              {/* Filtros — mismo diseño que el catálogo de modpacks */}
              <div className={`-mx-5 -mt-5 mb-4 px-4 py-3 border-b flex flex-wrap gap-2 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <FilterSelect
                  value={versionFilter}
                  onChange={(v) => setVersionFilter(String(v))}
                  options={versionOptions}
                  placeholder="Versión"
                  icon={Tag}
                  darkMode={darkMode}
                />
                <FilterSelect
                  value={loaderFilter}
                  onChange={(v) => setLoaderFilter(String(v))}
                  options={loaderOptions}
                  placeholder="Loader"
                  icon={Layers}
                  darkMode={darkMode}
                />
              </div>

              {loadingFiles ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-14 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
                  ))}
                </div>
              ) : filteredFiles.length === 0 ? (
                <p className={`text-sm ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                  No hay archivos para estos filtros.
                </p>
              ) : (
                <div className="space-y-2">
                  {pagedFiles.map(file => {
                    const installable = isInstallable(file);
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border gap-3 ${darkMode ? 'bg-gray-800/40 border-gray-700/40' : 'bg-gray-50 border-gray-200'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            {file.displayName || file.fileName}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {/* Versiones MC */}
                            {(file.gameVersions || []).filter(v => /^\d+\.\d+/.test(v)).slice(0, 3).map(v => (
                              <span key={v} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${darkMode ? 'bg-gray-700/60 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{v}</span>
                            ))}
                            {/* Loader */}
                            {getFileLoader(file) && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${darkMode ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                                {getFileLoader(file)}
                              </span>
                            )}
                            {/* Fecha */}
                            {formatFileDate(file.fileDate) && (
                              <span className={`text-[10px] ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                {formatFileDate(file.fileDate)}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => installable && onInstall(file.id)}
                          disabled={!!installing || !installable}
                          title={!installable ? `Solo se pueden instalar archivos compatibles con ${[version, loader ? LOADER_NAMES[Number(loader)] : null].filter(Boolean).join(' + ')}` : undefined}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                            !installable
                              ? darkMode ? 'border border-gray-700 text-gray-600 cursor-not-allowed' : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                              : installing
                                ? 'bg-purple-600/60 text-white/70 cursor-wait'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                          }`}
                        >
                          {installing && installable
                            ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" />
                            : <Download size={10} />}
                          {installable ? 'Instalar' : 'Incompatible'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Paginación */}
              {filesTotalPages > 1 && (
                <div className={`flex items-center justify-between mt-4 pt-3 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                  <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {filteredFiles.length} archivos
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFilesPage(p => Math.max(0, p - 1))}
                      disabled={filesPage === 0}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span className={`text-xs font-medium min-w-[60px] text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {filesPage + 1} / {filesTotalPages}
                    </span>
                    <button
                      onClick={() => setFilesPage(p => Math.min(filesTotalPages - 1, p + 1))}
                      disabled={filesPage >= filesTotalPages - 1}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                      aria-label="Página siguiente"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Capturas */}
          {detailTab === 'screenshots' && (
            mod.screenshots?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mod.screenshots.map(ss => (
                  <button
                    key={ss.id}
                    onClick={() => setLightboxSrc(ss.url || ss.thumbnailUrl)}
                    className={`aspect-video overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-xl group ${darkMode
                      ? 'border-purple-500/20 hover:border-purple-400/50'
                      : 'border-purple-200/60 hover:border-purple-300'
                    }`}
                    aria-label={ss.title || 'Ver screenshot en grande'}
                  >
                    <img
                      src={ss.thumbnailUrl || ss.url}
                      alt={ss.title || ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
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
      index: String(page * PAGE_SIZE),
      pageSize: String(PAGE_SIZE),
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
              depsNotice={depsNotice}
              onClearDeps={() => setDepsNotice(null)}
            />
          ) : (
            <>
              {/* ── Filtros ── */}
              <div className={`px-4 py-3 border-b flex-shrink-0 flex flex-wrap gap-2 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                {/* Búsqueda */}
                <div className={`relative flex-1 min-w-44`}>
                  <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    aria-label="Buscar mod por nombre"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar mod..."
                    className={`w-full pl-8 pr-3 px-3 py-2 rounded-xl text-sm border focus:outline-none transition-colors ${darkMode ? 'bg-gray-800/80 border-gray-700/80 text-gray-200 placeholder-gray-500 focus:border-purple-500/50' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 shadow-sm focus:border-purple-400'}`}
                  />
                </div>

                <FilterSelect
                  value={version}
                  onChange={v => { setVersion(v); setPage(0); }}
                  options={MC_VERSION_OPTIONS}
                  placeholder="Versión"
                  icon={Tag}
                  darkMode={darkMode}
                />

                <FilterSelect
                  value={loader}
                  onChange={v => { setLoader(v); setPage(0); }}
                  options={CATALOG_LOADER_OPTIONS}
                  placeholder="Loader"
                  icon={Layers}
                  darkMode={darkMode}
                />

                <FilterSelect
                  value={sortField}
                  onChange={v => { setSortField(String(v)); setPage(0); }}
                  options={SORT_OPTIONS}
                  placeholder="Ordenar"
                  icon={ArrowUpDown}
                  darkMode={darkMode}
                />
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
