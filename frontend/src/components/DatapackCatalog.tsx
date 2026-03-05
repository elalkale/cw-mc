import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Search, Database, Download, RefreshCw,
  ChevronLeft, ChevronRight, Tag, ArrowUpDown,
} from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api';
import FilterSelect from './FilterSelect';
import DescriptionHTML from './DescriptionHTML';
import Lightbox from './Lightbox';

const PAGE_SIZE = 20;
const FILES_PER_PAGE = 15;
const DATAPACK_CLASS_ID = 6945;

const SORT_OPTIONS = [
  { value: '2', label: 'Popularidad' },
  { value: '6', label: 'Descargas' },
  { value: '3', label: 'Actualización' },
  { value: '4', label: 'Nombre' },
];

const MC_VERSION_OPTIONS = [
  { value: '', label: 'Todas las versiones' },
  ...[
    '1.21.4','1.21.3','1.21.2','1.21.1','1.21',
    '1.20.6','1.20.5','1.20.4','1.20.3','1.20.2','1.20.1','1.20',
    '1.19.4','1.19.3','1.19.2','1.19.1','1.19',
    '1.18.2','1.18.1','1.18',
    '1.17.1','1.17',
    '1.16.5','1.16.4','1.16.3','1.16.2','1.16.1','1.16',
    '1.15.2','1.15.1','1.15',
    '1.14.4','1.14.3','1.14.2','1.14.1','1.14',
    '1.13.2','1.13.1','1.13',
    '1.12.2','1.12.1','1.12',
  ].map(v => ({ value: v, label: v })),
];

function formatDownloads(n: number): string {
  if (!n) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}

function formatFileDate(isoDate: string): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── DatapackCard ──────────────────────────────────────────────────────────────
function DatapackCard({
  mod, darkMode, installing, installed, error, onInstall, onDetail,
}: {
  mod: any; darkMode: boolean; installing: boolean; installed: boolean;
  error?: string; onInstall: () => void; onDetail: () => void;
}) {
  const [imgError, setImgError] = React.useState(false);
  return (
    <div
      onClick={onDetail}
      className={`rounded-2xl border flex flex-col transition-all cursor-pointer ${darkMode
        ? 'bg-gradient-to-br from-gray-800/90 to-gray-900 border-purple-500/25 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-900/20 hover:-translate-y-0.5'
        : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <div className="p-3 flex items-start gap-3 flex-1">
        {mod.logo?.thumbnailUrl && !imgError ? (
          <img src={mod.logo.thumbnailUrl} alt="" onError={() => setImgError(true)} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-black/10" />
        ) : (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${darkMode ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
            <Database size={20} className="text-indigo-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{mod.name}</p>
          <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{mod.summary}</p>
          {mod.authors?.length > 0 && (
            <p className={`text-[10px] mt-1 truncate ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              por {mod.authors.map((a: any) => a.name).join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className={`flex items-center justify-between px-3 py-2.5 border-t ${darkMode ? 'border-gray-700/50' : 'border-gray-100'}`} onClick={e => e.stopPropagation()}>
        <span className={`text-xs flex items-center gap-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
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
            disabled={installing}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed ${
              installing
                ? 'bg-purple-600/60 text-white/70 cursor-wait'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
            }`}
          >
            {installing ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={11} />}
            {installing ? 'Instalando...' : 'Instalar'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── DetailView ────────────────────────────────────────────────────────────────
function DetailView({
  mod, darkMode, installing, installed, installError,
  onInstall, onBack, mcVersion,
}: {
  mod: any; darkMode: boolean; installing: boolean; installed: boolean;
  installError?: string; onInstall: (fileId: number) => void;
  onBack: () => void; mcVersion: string;
}) {
  const [detailTab, setDetailTab] = useState<'desc' | 'versions' | 'screenshots'>('desc');
  const [description, setDescription] = useState('');
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);
  const [versionFilter, setVersionFilter] = useState('');
  const [filesPage, setFilesPage] = useState(0);

  const mainFileId = mod.mainFileId ?? mod.latestFilesIndexes?.[0]?.fileId ?? null;

  const filteredFiles = useMemo(() => {
    if (!versionFilter) return files;
    return files.filter(f => (f.gameVersions || []).includes(versionFilter));
  }, [files, versionFilter]);

  const filesTotalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE);
  const pagedFiles = filteredFiles.slice(filesPage * FILES_PER_PAGE, (filesPage + 1) * FILES_PER_PAGE);

  useEffect(() => { setFilesPage(0); }, [versionFilter]);

  const versionOptions = useMemo(() => {
    const versions = [...new Set(
      files.flatMap(f => (f.gameVersions || []) as string[]).filter(v => /^\d+\.\d+/.test(v))
    )].sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      return 0;
    });
    return [{ value: '', label: 'Todas las versiones' }, ...versions.map(v => ({ value: v, label: v }))];
  }, [files]);

  useEffect(() => {
    setLoadingDesc(true);
    fetchWithToken(`${API_BASE}/api/curseforge/mod/${mod.id}/description`)
      .then(r => r.json())
      .then(d => setDescription(d?.data ?? ''))
      .catch(() => {})
      .finally(() => setLoadingDesc(false));
  }, [mod.id]);

  useEffect(() => {
    if (detailTab !== 'versions') return;
    setLoadingFiles(true);
    fetchWithToken(`${API_BASE}/api/curseforge/mod/${mod.id}/files?pageSize=200`)
      .then(r => r.json())
      .then(d => {
        const all: any[] = d?.data ?? [];
        setFiles(all);
        const allGV = new Set(all.flatMap((f: any) => (f.gameVersions || []) as string[]));
        setVersionFilter(mcVersion && allGV.has(mcVersion) ? mcVersion : '');
      })
      .catch(() => {})
      .finally(() => setLoadingFiles(false));
  }, [mod.id, detailTab]);

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} darkMode={darkMode} />}

      {/* Back */}
      <div className={`flex items-center gap-2 px-5 py-3 border-b flex-shrink-0 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
        <button
          onClick={onBack}
          className={`flex items-center gap-1 text-sm transition-colors ${darkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'}`}
        >
          <ChevronLeft size={16} /> Volver al catálogo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Hero */}
        <div className={`relative px-5 py-5 border-b ${darkMode ? 'border-purple-500/25 bg-gray-800/50' : 'border-purple-200/50 bg-purple-50/40'}`}>
          <div className="flex items-start gap-4">
            {(mod.logo?.url || mod.logo?.thumbnailUrl) && !heroImgError ? (
              <img src={mod.logo.url || mod.logo.thumbnailUrl} alt="" onError={() => setHeroImgError(true)} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-black/10 shadow" />
            ) : (
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${darkMode ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                <Database size={28} className="text-indigo-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className={`text-lg font-bold leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{mod.name}</h2>
              {mod.authors?.length > 0 && (
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  por {mod.authors.map((a: any) => a.name).join(', ')}
                </p>
              )}
              <p className={`text-sm mt-2 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{mod.summary}</p>
              <span className={`inline-flex items-center gap-1 mt-3 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <Download size={11} /> {formatDownloads(mod.downloadCount)} descargas
              </span>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {installed ? (
                <span className="text-sm text-green-400 font-medium">✓ Instalado</span>
              ) : (
                <>
                  <button
                    onClick={() => mainFileId !== null && onInstall(mainFileId)}
                    disabled={installing || mainFileId === null}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed ${
                      mainFileId === null
                        ? darkMode ? 'border border-gray-700 text-gray-600' : 'border border-gray-200 text-gray-400'
                        : installing
                          ? 'bg-purple-600/60 text-white/70 cursor-wait'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                    }`}
                  >
                    {installing
                      ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
                      : <Download size={14} />}
                    {installing ? 'Instalando...' : 'Instalar'}
                  </button>
                  {installError && <p className="text-[11px] text-red-400 max-w-[160px] text-right">{installError}</p>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 px-5 py-2 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
          {(['desc', 'versions', 'screenshots'] as const).map(key => {
            const labels = { desc: 'Descripción', versions: 'Versiones', screenshots: 'Capturas' };
            return (
              <button
                key={key}
                onClick={() => setDetailTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  detailTab === key
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                    : darkMode ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {labels[key]}
                {key === 'screenshots' && mod.screenshots?.length > 0 && (
                  <span className={`ml-1 text-[10px] ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>({mod.screenshots.length})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {detailTab === 'desc' && (
            loadingDesc ? (
              <div className={`h-32 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
            ) : description ? (
              <DescriptionHTML html={description} darkMode={darkMode} />
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Sin descripción disponible.</p>
            )
          )}

          {detailTab === 'versions' && (
            <>
              <div className={`-mx-5 -mt-5 mb-4 px-4 py-3 border-b flex flex-wrap gap-2 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <FilterSelect value={versionFilter} onChange={v => setVersionFilter(String(v))} options={versionOptions} placeholder="Versión" icon={Tag} darkMode={darkMode} />
              </div>
              {loadingFiles ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <div key={i} className={`h-14 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />)}
                </div>
              ) : filteredFiles.length === 0 ? (
                <p className={`text-sm ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>No hay archivos para estos filtros.</p>
              ) : (
                <div className="space-y-2">
                  {pagedFiles.map(file => (
                    <div key={file.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border gap-3 transition-colors ${darkMode
                      ? 'bg-gray-800/50 border-purple-500/15 hover:border-purple-500/30 hover:bg-purple-950/10'
                      : 'bg-white border-gray-200 hover:border-purple-300 hover:bg-purple-50/40'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{file.displayName || file.fileName}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(file.gameVersions || []).filter((v: string) => /^\d+\.\d+/.test(v)).slice(0, 4).map((v: string) => (
                            <span key={v} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${darkMode ? 'bg-gray-700/60 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{v}</span>
                          ))}
                          {formatFileDate(file.fileDate) && (
                            <span className={`text-[10px] ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{formatFileDate(file.fileDate)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onInstall(file.id)}
                        disabled={installing}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                          installing
                            ? 'bg-purple-600/60 text-white/70 cursor-wait'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm'
                        }`}
                      >
                        {installing ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" /> : <Download size={10} />}
                        Instalar
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {filesTotalPages > 1 && (
                <div className={`flex items-center justify-between mt-4 pt-3 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                  <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{filteredFiles.length} archivos</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setFilesPage(p => Math.max(0, p - 1))} disabled={filesPage === 0}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500'}`}>
                      <ChevronLeft size={15} />
                    </button>
                    <span className={`text-xs font-medium min-w-[60px] text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{filesPage + 1} / {filesTotalPages}</span>
                    <button onClick={() => setFilesPage(p => Math.min(filesTotalPages - 1, p + 1))} disabled={filesPage >= filesTotalPages - 1}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500'}`}>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {detailTab === 'screenshots' && (
            mod.screenshots?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mod.screenshots.map((ss: any) => (
                  <button
                    key={ss.id}
                    onClick={() => setLightboxSrc(ss.url || ss.thumbnailUrl)}
                    className={`aspect-video overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-xl group ${darkMode ? 'border-purple-500/20 hover:border-purple-400/50' : 'border-gray-200 hover:border-purple-300'}`}
                  >
                    <img src={ss.thumbnailUrl || ss.url} alt={ss.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No hay capturas disponibles.</p>
            )
          )}
        </div>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props {
  server: string;
  mcVersion: string;
  darkMode: boolean;
  onClose: () => void;
  onInstalled: () => void;
}

export default function DatapackCatalog({ server, mcVersion, darkMode, onClose, onInstalled }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [version, setVersion] = useState(mcVersion || '');
  const [sortField, setSortField] = useState('2');
  const [page, setPage] = useState(0);
  const [mods, setMods] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<number | null>(null);
  const [installErrors, setInstallErrors] = useState<Record<number, string>>({});
  const [installedIds, setInstalledIds] = useState(new Set<number>());
  const [selectedMod, setSelectedMod] = useState<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => { setPage(0); }, [version, sortField]);

  useEffect(() => {
    if (selectedMod) return;
    setLoading(true);
    const params = new URLSearchParams({
      classId: String(DATAPACK_CLASS_ID),
      sortField,
      sortOrder: 'desc',
      pageSize: String(PAGE_SIZE),
      index: String(page * PAGE_SIZE),
    });
    if (debouncedSearch) params.set('searchFilter', debouncedSearch);
    if (version) params.set('gameVersion', version);

    fetchWithToken(`${API_BASE}/api/curseforge/mods/search?${params}`)
      .then(r => r.json())
      .then(d => {
        setMods(d?.data ?? []);
        setTotalCount(d?.pagination?.totalCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedSearch, version, sortField, page, selectedMod]);

  useEffect(() => {
    if (!selectedMod) inputRef.current?.focus();
  }, [selectedMod]);

  async function handleInstall(mod: any, fileId: number) {
    setInstalling(mod.id);
    setInstallErrors(prev => { const n = { ...prev }; delete n[mod.id]; return n; });
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/servers/${encodeURIComponent(server)}/datapacks/install`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modId: mod.id, fileId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al instalar');
      setInstalledIds(prev => new Set([...prev, mod.id]));
      onInstalled();
    } catch (err: any) {
      setInstallErrors(prev => ({ ...prev, [mod.id]: err.message ?? 'Error' }));
    } finally {
      setInstalling(null);
    }
  }

  const totalPages = Math.ceil(Math.min(totalCount, 10000) / PAGE_SIZE);

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-3 md:p-6">
        <div
          className={`w-full max-w-4xl h-full max-h-[88vh] rounded-2xl shadow-2xl border pointer-events-auto flex flex-col ${darkMode
            ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/40'
            : 'bg-white border-purple-200/70'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-indigo-500/15' : 'bg-indigo-100'}`}>
                <Database size={14} className="text-indigo-400" />
              </div>
              <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Catálogo de Datapacks —{' '}
                <span className={darkMode ? 'text-purple-400' : 'text-purple-600'}>{server}</span>
              </h3>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
            >
              <X size={15} />
            </button>
          </div>

          {selectedMod ? (
            <DetailView
              mod={selectedMod}
              darkMode={darkMode}
              installing={installing === selectedMod.id}
              installed={installedIds.has(selectedMod.id)}
              installError={installErrors[selectedMod.id]}
              onInstall={fileId => handleInstall(selectedMod, fileId)}
              onBack={() => setSelectedMod(null)}
              mcVersion={version}
            />
          ) : (
            <>
              {/* Filters */}
              <div className={`px-4 py-3 border-b flex-shrink-0 flex flex-wrap gap-2 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="relative flex-1 min-w-44">
                  <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar datapacks..."
                    className={`w-full pl-8 pr-3 py-2 rounded-xl text-sm border focus:outline-none transition-all ${darkMode
                      ? 'bg-gray-800/80 border-gray-700/80 text-gray-200 placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20'
                      : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
                    }`}
                  />
                </div>
                <FilterSelect
                  value={version}
                  onChange={v => { setVersion(String(v)); setPage(0); }}
                  options={MC_VERSION_OPTIONS}
                  placeholder="Versión"
                  icon={Tag}
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

              {/* Grid */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className={`h-36 rounded-2xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
                    ))}
                  </div>
                ) : mods.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center gap-3 py-16 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    <Database size={40} className="opacity-25" />
                    <p className="text-sm">No se encontraron datapacks</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mods.map(mod => (
                      <DatapackCard
                        key={mod.id}
                        mod={mod}
                        darkMode={darkMode}
                        installing={installing === mod.id}
                        installed={installedIds.has(mod.id)}
                        error={installErrors[mod.id]}
                        onInstall={() => {
                          const fileId = mod.mainFileId ?? mod.latestFilesIndexes?.[0]?.fileId;
                          if (fileId) handleInstall(mod, fileId);
                        }}
                        onDetail={() => setSelectedMod(mod)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className={`flex items-center justify-between px-5 py-3 border-t flex-shrink-0 ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {loading && <RefreshCw size={11} className="animate-spin inline mr-1" />}
                  {totalCount > 0 ? `${totalCount.toLocaleString()} resultados` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500'}`}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className={`text-xs font-medium min-w-[60px] text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1 || loading}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500'}`}
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
