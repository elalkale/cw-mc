import React, { useState, useMemo, useEffect } from 'react';
import { Download, Server, ChevronLeft, ChevronRight, Search, Tag, ArrowUpDown } from 'lucide-react';
import { fetchWithToken, API_BASE } from '../lib/api';
import FilterSelect from './FilterSelect';

const SORT_OPTIONS = [
  { value: 'date', label: 'Más reciente' },
  { value: 'name', label: 'Nombre A–Z' },
  { value: 'oldest', label: 'Más antiguo' },
];

export default function VersionsTab({
  files: _files,
  loadingFiles: _loadingFiles,
  filesPage: _filesPage,
  setFilesPage: _setFilesPage,
  filesTotalCount: _filesTotalCount,
  downloadingFile,
  onDownloadFile,
  installStatus,
  onInstallFile,
  darkMode,
  modId,
}) {
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [versionFilter, setVersionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [filesPage, setFilesPage] = useState(0);
  const FILES_PER_PAGE = 50;

  // Cargar TODOS los archivos al montar
  useEffect(() => {
    if (!modId) return;
    
    setLoadingFiles(true);
    const fetchAllFiles = async () => {
      try {
        const PAGE = 50;
        const firstPageRes = await fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/files?index=0&pageSize=${PAGE}`);
        const firstPageData = await firstPageRes.json();
        const first = firstPageData.data || [];
        const total = firstPageData.pagination?.totalCount ?? first.length;

        if (total <= PAGE) {
          setFiles(first);
        } else {
          const extraPages = Math.ceil((total - PAGE) / PAGE);
          const results = await Promise.all(
            Array.from({ length: extraPages }, (_, i) =>
              fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/files?index=${(i + 1) * PAGE}&pageSize=${PAGE}`)
                .then(r => r.json())
                .then(d => d.data || [])
                .catch(() => [])
            )
          );
          setFiles([...first, ...results.flat()]);
        }
      } catch (error) {
        console.error('Error fetching all files:', error);
      } finally {
        setLoadingFiles(false);
      }
    };

    fetchAllFiles();
  }, [modId]);

  const serverFiles = files.filter(f => f.serverPackFileId || f.isServerPack);

  // Generar opciones de versión desde TODOS los archivos
  const versionOptions = useMemo(() => {
    const versions = [...new Set(
      serverFiles.flatMap(f => f.gameVersions || []).filter(v => typeof v === 'string' && /^\d+\.\d+/.test(v))
    )].sort((a, b) => {
      const pa = (a as string).split('.').map(Number);
      const pb = (b as string).split('.').map(Number);
      for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      return 0;
    });
    return [{ value: '', label: 'Todas las versiones' }, ...versions.map(v => ({ value: v as string, label: v as string }))];
  }, [serverFiles]) as Array<{ value: string; label: string; }>;

  // Aplicar filtros sobre todos los archivos
  const filteredFiles = useMemo(() => {
    let result = serverFiles;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f => (f.displayName || f.fileName).toLowerCase().includes(query));
    }

    if (versionFilter) {
      result = result.filter(f => (f.gameVersions || []).includes(versionFilter));
    }

    const sorted = [...result];
    switch (sortBy) {
      case 'date':
        sorted.sort((a, b) => new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.fileDate).getTime() - new Date(b.fileDate).getTime());
        break;
      case 'name':
        sorted.sort((a, b) => (a.displayName || a.fileName).localeCompare(b.displayName || b.fileName));
        break;
    }

    return sorted;
  }, [serverFiles, searchQuery, versionFilter, sortBy]);

  // Reset página cuando cambian los filtros
  useEffect(() => { setFilesPage(0); }, [searchQuery, versionFilter, sortBy]);

  const totalFilePages = Math.ceil(filteredFiles.length / FILES_PER_PAGE);
  const pagedFiles = filteredFiles.slice(filesPage * FILES_PER_PAGE, (filesPage + 1) * FILES_PER_PAGE);

  return (
    <>
      {/* ── Filtros ──────────────────────────────────────────────────────────── */}
      <div className={`flex flex-col sm:flex-row flex-wrap gap-2.5 mb-6 p-3 rounded-2xl border ${darkMode ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white/70 border-gray-200/80 shadow-sm'}`}>
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar versión..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm transition-all focus:outline-none ${darkMode
              ? 'bg-gray-800/80 border-gray-700/80 text-gray-200 placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-400 focus:ring-1 focus:ring-purple-300/30'
            }`}
            aria-label="Buscar versión por nombre"
          />
        </div>

        <FilterSelect 
          value={versionFilter} 
          onChange={(v) => setVersionFilter(String(v))} 
          options={versionOptions} 
          placeholder="Versión" 
          icon={Tag}
          darkMode={darkMode} 
        />
        <FilterSelect 
          value={sortBy} 
          onChange={(v) => setSortBy(String(v))} 
          options={SORT_OPTIONS} 
          placeholder="Ordenar" 
          icon={ArrowUpDown}
          darkMode={darkMode} 
        />
      </div>

      {/* ── Contador ─────────────────────────────────────────────────────────── */}
      {filteredFiles.length > 0 && (
        <p className={`text-xs mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          <span className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{filteredFiles.length.toLocaleString()}</span> archivos
          {searchQuery && ` · búsqueda: "${searchQuery}"`}
          {versionFilter && ` · versión: ${versionFilter}`}
          {totalFilePages > 1 && ` · página ${filesPage + 1} de ${totalFilePages}`}
        </p>
      )}

      {loadingFiles ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`h-10 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-200'}`} />
          ))}
        </div>
      ) : filteredFiles.length === 0 ? (
        <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          No hay resultados para este filtro.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs uppercase tracking-widest border-b ${darkMode ? 'text-gray-500 border-gray-700/60' : 'text-gray-400 border-gray-200'}`}>
                <th className="pb-3 text-left font-semibold">Nombre</th>
                <th className="pb-3 text-left font-semibold">Versión MC</th>
                <th className="pb-3 text-left font-semibold">Fecha</th>
                <th className="pb-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-gray-700/40' : 'divide-gray-200'}`}>
              {pagedFiles.map(file => (
                <tr key={file.id} className={`transition-colors ${darkMode ? 'hover:bg-purple-500/5' : 'hover:bg-purple-50/60'}`}>
                  <td className="py-3 pr-4">
                    <span className={`line-clamp-1 text-xs font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      {file.displayName || file.fileName}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {(file.gameVersions ?? []).filter(v => /^\d+\.\d+/.test(v)).slice(0, 3).map(v => (
                        <span key={v} className={`px-1.5 py-0.5 rounded-lg text-xs border font-mono ${darkMode ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-200/80'}`}>
                          {v}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`py-3 pr-4 whitespace-nowrap text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {new Date(file.fileDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex gap-1.5 justify-end">
                      <button
                        onClick={() => onDownloadFile(file.serverPackFileId ?? file.id)}
                        disabled={downloadingFile === (file.serverPackFileId ?? file.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm"
                        aria-label={`Descargar ${file.displayName}`}
                      >
                        {downloadingFile === (file.serverPackFileId ?? file.id)
                          ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" />
                          : <Download size={11} aria-hidden="true" />
                        }
                        Descargar
                      </button>
                      <button
                        onClick={() => onInstallFile(file.serverPackFileId ?? file.id, file.displayName || file.fileName, file.gameVersions ?? [])}
                        disabled={installStatus === 'installing'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${darkMode
                          ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50'
                          : 'border-purple-400/60 text-purple-700 hover:bg-purple-50'
                        }`}
                        aria-label={`Instalar ${file.displayName}`}
                      >
                        <Server size={11} aria-hidden="true" />
                        Instalar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredFiles.length > FILES_PER_PAGE && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={() => setFilesPage(p => Math.max(0, p - 1))}
            disabled={filesPage === 0}
            className={`p-2 rounded-xl border transition-all ${filesPage === 0
              ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-transparent shadow-md hover:scale-[1.05] active:scale-95'
            }`}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className={`text-sm tabular-nums px-3 py-1.5 rounded-xl border ${darkMode ? 'bg-gray-800/60 border-gray-700/60 text-gray-400' : 'bg-white border-gray-200 text-gray-500 shadow-sm'}`}>
            {filesPage + 1} / {totalFilePages}
          </span>
          <button
            onClick={() => setFilesPage(p => Math.min(totalFilePages - 1, p + 1))}
            disabled={filesPage >= totalFilePages - 1}
            className={`p-2 rounded-xl border transition-all ${filesPage >= totalFilePages - 1
              ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-transparent shadow-md hover:scale-[1.05] active:scale-95'
            }`}
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
