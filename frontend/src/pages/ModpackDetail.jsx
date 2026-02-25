import React from 'react';
import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api.js';
import modpacksData from '../resources/modpacks_with_server.json';

const LOADER_NAMES = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };
const LOADER_COLORS = {
  1: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  4: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  5: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  6: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

// Componente aislado para la descripción HTML.
// Al ser memo + innerHTML directo, React nunca vuelve a tocar el DOM interno
// aunque el padre re-renderice, evitando que el navegador reintente las imágenes rotas.
const DescriptionHTML = memo(function DescriptionHTML({ html, darkMode }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !html) return;
    ref.current.innerHTML = html;
    ref.current.querySelectorAll('img').forEach(img => {
      img.onerror = () => { img.style.display = 'none'; };
    });
  }, [html]);
  return (
    <div
      ref={ref}
      className={`prose prose-sm max-w-none ${darkMode ? 'prose-invert' : ''} [&_img]:rounded-lg [&_img]:max-w-full [&_a]:text-purple-400`}
    />
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatBadge({ label, value, darkMode }) {
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-xl border ${darkMode
      ? 'bg-gray-800/60 border-purple-500/20'
      : 'bg-gray-100 border-purple-300/40'
    }`}>
      <span className={`text-xs uppercase tracking-wide mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
      <span className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ModpackDetail({ darkMode }) {
  const { modId } = useParams();
  const navigate = useNavigate();

  // Datos locales (siempre disponibles, sin petición de red)
  const localPack = modpacksData.find(m => m.modId === Number(modId));

  // Datos de CurseForge (logo full, summary, screenshots, description)
  const [cfMod, setCfMod] = useState(null);

  // Mezcla los datos del JSON con los frescos de la API cuando llegan
  const livePack = useMemo(() => {
    if (!cfMod || !localPack) return localPack;
    const liveLoaders = cfMod.latestFilesIndexes?.length
      ? [...new Set(cfMod.latestFilesIndexes.map(f => f.modLoader).filter(Boolean))]
      : null;
    const liveVersions = cfMod.latestFilesIndexes?.length
      ? [...new Set(cfMod.latestFilesIndexes.map(f => f.gameVersion).filter(Boolean))]
      : null;
    return {
      ...localPack,
      downloadCount: cfMod.downloadCount ?? localPack.downloadCount,
      gamePopularityRank: cfMod.gamePopularityRank ?? localPack.gamePopularityRank,
      dateModified: cfMod.dateModified ?? localPack.dateModified,
      dateReleased: cfMod.dateReleased ?? localPack.dateReleased,
      ...(liveLoaders && { modLoaders: liveLoaders }),
      ...(liveVersions && { gameVersions: liveVersions }),
    };
  }, [cfMod, localPack]);
  const [description, setDescription] = useState('');
  const [loadingMod, setLoadingMod] = useState(true);
  const [loadingDesc, setLoadingDesc] = useState(true);

  // Descarga
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  // Lista de versiones / archivos del modpack
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [filesPage, setFilesPage] = useState(0);       // índice (0-based × 50)
  const [filesTotalCount, setFilesTotalCount] = useState(0);
  const [downloadingFile, setDownloadingFile] = useState(null); // fileId en curso

  // Pestaña activa
  const [tab, setTab] = useState('descripcion');

  // Visor de screenshot a pantalla completa
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!modId) return;

    setLoadingMod(true);
    setLoadingDesc(true);
    setCfMod(null);
    setDescription('');

    // Datos del mod
    fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}`)
      .then(r => r.json())
      .then(data => { if (data?.data) setCfMod(data.data); })
      .catch(console.error)
      .finally(() => setLoadingMod(false));

    // Descripción HTML
    fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/description`)
      .then(r => r.json())
      .then(data => { if (data?.data) setDescription(data.data); })
      .catch(console.error)
      .finally(() => setLoadingDesc(false));
  }, [modId]);

  // Fetch lista de archivos (paginada, 50 por página)
  useEffect(() => {
    if (!modId) return;
    setLoadingFiles(true);
    setFiles([]);
    fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/files?index=${filesPage * 50}&pageSize=50`)
      .then(r => r.json())
      .then(data => {
        if (data?.data) setFiles(data.data);
        if (data?.pagination?.totalCount != null) setFilesTotalCount(data.pagination.totalCount);
      })
      .catch(console.error)
      .finally(() => setLoadingFiles(false));
  }, [modId, filesPage]);

  // Cerrar lightbox con Escape
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e) => { if (e.key === 'Escape') setLightbox(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightbox]);

  const downloadFile = async (fileId) => {
    setDownloadingFile(fileId);
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/curseforge/mod/${modId}/file/${fileId}/download-url`
      );
      const data = await res.json();
      const url = data?.data;
      if (!url) throw new Error('URL no disponible');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silencioso; el botón simplemente vuelve a su estado normal
    } finally {
      setDownloadingFile(null);
    }
  };

  const downloadServerPack = async () => {
    if (!localPack?.serverFileId) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/curseforge/mod/${modId}/file/${localPack.serverFileId}/download-url`
      );
      const data = await res.json();
      const url = data?.data;
      if (!url) throw new Error('No se pudo obtener la URL de descarga');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  // ── Estados de carga / error ─────────────────────────────────────────────────

  const bg = darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900';
  const cardClass = `rounded-2xl border p-6 transition-colors ${darkMode
    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20'
    : 'bg-gradient-to-br from-white to-gray-100 border-purple-300/40'
  }`;

  if (!localPack) {
    return (
      <div className={`max-w-5xl mx-auto mt-6 px-4 md:px-6 ${bg}`}>
        <button onClick={() => navigate('/catalog')} className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6">
          <ArrowLeft size={18} /> Volver al catálogo
        </button>
        <div role="alert" className="bg-red-900/20 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg">
          Modpack no encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-5xl mx-auto mt-2 md:mt-6 px-4 md:px-6 pb-12 transition-colors ${bg}`}>

      {/* Botón volver */}
      <button
        onClick={() => navigate('/catalog')}
        className={`flex items-center gap-2 text-sm mb-6 px-4 py-2 rounded-lg transition border ${darkMode
          ? 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border-purple-500/30'
          : 'bg-purple-200/30 hover:bg-purple-300/30 text-purple-700 border-purple-400/50'
        }`}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver al catálogo
      </button>

      {/* Hero: logo + info básica + botón descarga */}
      <div className={`${cardClass} flex flex-col md:flex-row gap-6 mb-6`}>
        {/* Logo */}
        <div className="flex-shrink-0">
          {loadingMod ? (
            <div className="w-32 h-32 rounded-xl bg-gray-700/50 animate-pulse" />
          ) : cfMod?.logo?.url ? (
            <img
              src={cfMod.logo.url}
              alt={`Logo de ${localPack.name}`}
              className="w-32 h-32 rounded-xl object-cover border-2 border-purple-500/30 shadow-lg"
            />
          ) : (
            <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-5xl shadow-lg">
              📦
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className={`text-2xl md:text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent mb-2 leading-tight ${darkMode ? 'from-purple-300 to-pink-300' : 'from-purple-700 to-pink-600'}`}>
            {localPack.name}
          </h1>

          {cfMod?.summary && (
            <p className={`text-sm mb-3 leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {cfMod.summary}
            </p>
          )}

          {/* Creador */}
          {cfMod?.authors?.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Creado por</span>
              <div className="flex flex-wrap gap-1.5">
                {cfMod.authors.map(author => (
                  <a
                    key={author.id}
                    href={author.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition hover:scale-105 ${darkMode
                      ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/35'
                      : 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'
                    }`}
                  >
                    {author.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Loaders */}
          <div className="flex flex-wrap gap-2 mb-4">
            {livePack.modLoaders.map(l => LOADER_NAMES[l] && (
              <span key={l} className={`px-2 py-0.5 rounded-full text-xs border font-medium ${LOADER_COLORS[l] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
                {LOADER_NAMES[l]}
              </span>
            ))}
            {livePack.gameVersions.slice(0, 4).map(v => (
              <span key={v} className={`px-2 py-0.5 rounded text-xs border ${darkMode ? 'bg-gray-700/50 text-gray-300 border-gray-600' : 'bg-gray-200 text-gray-700 border-gray-300'}`}>
                {v}
              </span>
            ))}
            {livePack.gameVersions.length > 4 && (
              <span className="text-xs text-gray-500 self-center">+{livePack.gameVersions.length - 4} más</span>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={downloadServerPack}
              disabled={downloading || !localPack.serverFileId}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" aria-hidden="true" />
              ) : (
                <Download size={16} aria-hidden="true" />
              )}
              {downloading ? 'Obteniendo enlace...' : 'Descargar Server Pack'}
            </button>

            <a
              href={`https://www.curseforge.com/minecraft/modpacks/${localPack.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border transition ${darkMode
                ? 'border-gray-600 text-gray-300 hover:border-purple-400 hover:text-purple-300'
                : 'border-gray-300 text-gray-700 hover:border-purple-500 hover:text-purple-700'
              }`}
            >
              <ExternalLink size={15} aria-hidden="true" />
              Ver en CurseForge
            </a>
          </div>

          {downloadError && (
            <p className="mt-2 text-sm text-red-400">{downloadError}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatBadge label="Descargas" value={livePack.downloadCount.toLocaleString()} darkMode={darkMode} />
        <StatBadge label="Publicado" value={new Date(livePack.dateReleased).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} darkMode={darkMode} />
        <StatBadge label="Actualizado" value={new Date(livePack.dateModified).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} darkMode={darkMode} />
        <StatBadge label="Popularidad" value={`#${livePack.gamePopularityRank.toLocaleString()}`} darkMode={darkMode} />
      </div>

      {/* ── Pestañas ── */}
      <div className={`flex gap-1 p-1 rounded-xl mb-4 ${darkMode ? 'bg-gray-800/60' : 'bg-gray-200/60'}`} role="tablist">
        {[
          { id: 'descripcion', label: 'Descripción' },
          { id: 'screenshots', label: `Screenshots${cfMod?.screenshots?.length ? ` (${cfMod.screenshots.length})` : ''}` },
          { id: 'versiones',   label: `Versiones${filesTotalCount ? ` (${filesTotalCount})` : ''}` },
        ].map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${tab === t.id
              ? 'bg-purple-600 text-white shadow'
              : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido de pestaña ── */}
      <section className={cardClass}>

        {/* Descripción */}
        {tab === 'descripcion' && (
          loadingDesc ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 rounded bg-gray-700/50 animate-pulse" style={{ width: `${85 - i * 10}%` }} />
              ))}
            </div>
          ) : description ? (
            <DescriptionHTML html={description} darkMode={darkMode} />
          ) : (
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Sin descripción disponible.</p>
          )
        )}

        {/* Screenshots */}
        {tab === 'screenshots' && (
          !cfMod?.screenshots?.length ? (
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>No hay screenshots disponibles.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cfMod.screenshots.map(ss => (
                <button
                  key={ss.id}
                  onClick={() => setLightbox(ss.url || ss.thumbnailUrl)}
                  className="aspect-video overflow-hidden rounded-lg border border-purple-500/20 hover:border-purple-400/60 transition group"
                  aria-label={ss.title || 'Ver screenshot en grande'}
                >
                  <img
                    src={ss.thumbnailUrl}
                    alt={ss.title || `Screenshot ${ss.id}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )
        )}

        {/* Versiones */}
        {tab === 'versiones' && (
          <>
            {filesTotalCount > 0 && (
              <p className={`text-xs mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {filesTotalCount.toLocaleString()} archivos · página {filesPage + 1} de {Math.ceil(filesTotalCount / 50)}
              </p>
            )}

            {loadingFiles ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`h-10 rounded-lg animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-200'}`} />
                ))}
              </div>
            ) : files.filter(f => f.serverPackFileId || f.isServerPack).length === 0 ? (
              <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>No hay server packs disponibles en esta página.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-xs uppercase tracking-wide border-b ${darkMode ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-200'}`}>
                      <th className="pb-2 text-left font-medium">Nombre</th>
                      <th className="pb-2 text-left font-medium">Versión MC</th>
                      <th className="pb-2 text-left font-medium">Fecha</th>
                      <th className="pb-2 text-right font-medium">Descarga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/30">
                    {files.filter(f => f.serverPackFileId || f.isServerPack).map(file => (
                      <tr key={file.id} className={`transition-colors ${darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-100'}`}>
                        <td className="py-2.5 pr-4">
                          <span className={`line-clamp-1 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            {file.displayName || file.fileName}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {(file.gameVersions ?? []).filter(v => /^\d+\.\d+/.test(v)).slice(0, 3).map(v => (
                              <span key={v} className={`px-1.5 py-0.5 rounded text-xs border ${darkMode ? 'bg-gray-700/50 text-gray-300 border-gray-600' : 'bg-gray-200 text-gray-700 border-gray-300'}`}>
                                {v}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className={`py-2.5 pr-4 whitespace-nowrap ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {new Date(file.fileDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => downloadFile(file.serverPackFileId ?? file.id)}
                            disabled={downloadingFile === (file.serverPackFileId ?? file.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600/80 hover:bg-purple-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`Descargar ${file.displayName}`}
                          >
                            {downloadingFile === (file.serverPackFileId ?? file.id)
                              ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" />
                              : <Download size={13} aria-hidden="true" />
                            }
                            Server pack
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filesTotalCount > 50 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => setFilesPage(p => Math.max(0, p - 1))}
                  disabled={filesPage === 0}
                  className={`p-1.5 rounded-lg transition ${filesPage === 0
                    ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {filesPage + 1} / {Math.ceil(filesTotalCount / 50)}
                </span>
                <button
                  onClick={() => setFilesPage(p => Math.min(Math.ceil(filesTotalCount / 50) - 1, p + 1))}
                  disabled={filesPage >= Math.ceil(filesTotalCount / 50) - 1}
                  className={`p-1.5 rounded-lg transition ${filesPage >= Math.ceil(filesTotalCount / 50) - 1
                    ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}

      </section>

      {/* Lightbox de screenshots */}
      {lightbox && (
        <>
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="relative max-w-4xl w-full pointer-events-auto">
              <button
                onClick={() => setLightbox(null)}
                className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm"
                aria-label="Cerrar imagen"
              >
                ✖ Cerrar
              </button>
              <img
                src={lightbox}
                alt="Screenshot en grande"
                className="w-full rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
