import React from 'react';
import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, ChevronLeft, ChevronRight, Server, X, Star } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api.js';
import modpacksData from '../resources/modpacks_with_server.json';

const LOADER_NAMES = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };
const LOADER_COLORS = {
  1: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  4: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  5: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  6: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
};
const LOADER_COLORS_LIGHT = {
  1: 'bg-orange-50 text-orange-700 border-orange-200',
  4: 'bg-blue-50 text-blue-700 border-blue-200',
  5: 'bg-purple-50 text-purple-700 border-purple-200',
  6: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

// Componente aislado para la descripción HTML.
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
    <div className={`flex flex-col items-center px-4 py-3 rounded-2xl border ${darkMode
      ? 'bg-gradient-to-br from-gray-800/90 to-gray-900 border-purple-500/25'
      : 'bg-gradient-to-br from-white to-purple-50/60 border-purple-300/60 shadow-sm'
    }`}>
      <span className={`text-xs uppercase tracking-widest font-semibold mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
      <span className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ModpackDetail({ darkMode, onInstallStart, onInstallClear, installations = {} }) {
  const { modId } = useParams();
  const navigate = useNavigate();

  const localPack = modpacksData.find(m => m.modId === Number(modId));

  const [cfMod, setCfMod] = useState(null);

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

  const [description,  setDescription]  = useState('');
  const [loadingMod,   setLoadingMod]   = useState(true);
  const [loadingDesc,  setLoadingDesc]  = useState(true);

  const [downloading,    setDownloading]    = useState(false);
  const [downloadError,  setDownloadError]  = useState('');

  const [files,           setFiles]           = useState([]);
  const [loadingFiles,    setLoadingFiles]    = useState(true);
  const [filesPage,       setFilesPage]       = useState(0);
  const [filesTotalCount, setFilesTotalCount] = useState(0);
  const [downloadingFile, setDownloadingFile] = useState(null);

  const [showInstallModal,  setShowInstallModal]  = useState(false);
  const [serverNameInput,   setServerNameInput]   = useState('');
  const [installFileId,     setInstallFileId]     = useState(null);
  const [installFileLabel,  setInstallFileLabel]  = useState('');
  const currentInstall  = Object.entries(installations).find(([, info]) => info.modId === localPack?.modId);
  const installStatus   = currentInstall?.[1]?.status ?? 'idle';
  const installError    = currentInstall?.[1]?.error ?? '';

  const currentInstallRef = useRef(null);
  useEffect(() => { currentInstallRef.current = currentInstall; }, [currentInstall]);
  useEffect(() => {
    return () => {
      const install = currentInstallRef.current;
      if (install?.[1]?.status === 'done') onInstallClear?.(install[0]);
    };
  }, []);

  const [tab,      setTab]      = useState('descripcion');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!modId) return;
    setLoadingMod(true);
    setLoadingDesc(true);
    setCfMod(null);
    setDescription('');

    fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}`)
      .then(r => r.json())
      .then(data => { if (data?.data) setCfMod(data.data); })
      .catch(console.error)
      .finally(() => setLoadingMod(false));

    fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/description`)
      .then(r => r.json())
      .then(data => { if (data?.data) setDescription(data.data); })
      .catch(console.error)
      .finally(() => setLoadingDesc(false));
  }, [modId]);

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

  const startInstall = async () => {
    const name = serverNameInput.trim();
    if (!name) return;
    const fileId = installFileId ?? localPack.serverFileId;
    setShowInstallModal(false);
    try {
      const res = await fetchWithToken(`${API_BASE}/api/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modId: localPack.modId, fileId, serverName: name }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onInstallStart?.(data.installId, {
        modId: localPack.modId,
        serverName: name,
        modName: localPack.name,
        logo: cfMod?.logo?.thumbnailUrl ?? null,
      });
    } catch (err) {
      onInstallStart?.(`err-${Date.now()}`, {
        modId: localPack.modId,
        serverName: name,
        modName: localPack.name,
        logo: cfMod?.logo?.thumbnailUrl ?? null,
        status: 'error',
        error: err.message,
      });
    }
  };

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e) => { if (e.key === 'Escape') setLightbox(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightbox]);

  const downloadFile = async (fileId) => {
    setDownloadingFile(fileId);
    try {
      const res  = await fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/file/${fileId}/download-url`);
      const data = await res.json();
      const url  = data?.data;
      if (!url) throw new Error('URL no disponible');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silencioso
    } finally {
      setDownloadingFile(null);
    }
  };

  const downloadServerPack = async () => {
    if (!localPack?.serverFileId) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const res  = await fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/file/${localPack.serverFileId}/download-url`);
      const data = await res.json();
      const url  = data?.data;
      if (!url) throw new Error('No se pudo obtener la URL de descarga');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  // ── Estilos reutilizables ─────────────────────────────────────────────────

  const bg = darkMode
    ? "bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]"
    : "bg-[radial-gradient(ellipse_at_top,_#ede9fe_0%,_#f9f9ff_55%,_#faf5ff_100%)]";

  const cardClass = darkMode
    ? 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/30'
    : 'bg-gradient-to-br from-white to-purple-50/70 border-purple-300/60 shadow-sm';

  if (!localPack) {
    return (
      <div className={`min-h-screen relative ${bg}`}>
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-8">
          <button
            onClick={() => navigate('/catalog')}
            className={`flex items-center gap-2 text-sm mb-6 px-3.5 py-2 rounded-xl border transition-all hover:scale-[1.02] ${darkMode
              ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10'
              : 'border-purple-400/60 text-purple-700 hover:bg-purple-50'
            }`}
          >
            <ArrowLeft size={15} /> Volver al catálogo
          </button>
          <div role="alert" className={`px-4 py-3 rounded-xl border text-sm ${darkMode
            ? 'bg-red-500/10 border-red-500/25 text-red-300'
            : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            Modpack no encontrado.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative transition-colors duration-300 ${bg}`}>

      {/* Blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 ${darkMode ? "bg-purple-600" : "bg-purple-400"}`} />
        <div className={`absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 ${darkMode ? "bg-pink-600" : "bg-pink-400"}`} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-8 pb-16">

        {/* ── Botón volver ─────────────────────────────────────────────────── */}
        <button
          onClick={() => navigate('/catalog')}
          className={`flex items-center gap-2 text-sm mb-6 px-3.5 py-2 rounded-xl border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
            ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50'
            : 'border-purple-400/60 text-purple-700 hover:bg-purple-50 hover:border-purple-500/70'
          }`}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Volver al catálogo
        </button>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className={`rounded-2xl border overflow-hidden mb-5 ${cardClass}`}>

          {/* Banner */}
          <div className="h-28 sm:h-36 relative overflow-hidden flex-shrink-0 z-0">
            {cfMod?.logo?.url && (
              <img src={cfMod.logo.url} alt="" aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-25" />
            )}
            <div className={`absolute inset-0 ${darkMode
              ? 'bg-gradient-to-br from-purple-900/70 via-indigo-900/40 to-pink-900/60'
              : 'bg-gradient-to-br from-purple-200/80 via-indigo-100 to-pink-200/80'
            }`} />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
            {localPack.isFeatured && (
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-400/90 text-yellow-900">
                <Star size={10} fill="currentColor" /> Destacado
              </div>
            )}
          </div>

          {/* Logo + Info */}
          <div className="px-5 pb-5 -mt-10 sm:-mt-12 flex flex-col sm:flex-row gap-4 sm:gap-5 relative z-10">
            {/* Logo */}
            <div className="flex-shrink-0">
              {loadingMod ? (
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 animate-pulse ${darkMode ? 'bg-gray-700 border-gray-900' : 'bg-gray-200 border-white'}`} />
              ) : cfMod?.logo?.url ? (
                <img
                  src={cfMod.logo.url}
                  alt={`Logo de ${localPack.name}`}
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 shadow-xl ${darkMode ? 'border-gray-900' : 'border-white'}`}
                />
              ) : (
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl shadow-xl ${darkMode ? 'border-gray-900' : 'border-white'}`}>
                  📦
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-2 sm:pt-8">
              <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-1.5 leading-tight bg-gradient-to-r bg-clip-text text-transparent ${darkMode ? 'from-purple-300 via-pink-300 to-purple-200' : 'from-purple-700 to-pink-600'}`}>
                {localPack.name}
              </h1>

              {cfMod?.summary && (
                <p className={`text-sm mb-3 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {cfMod.summary}
                </p>
              )}

              {/* Autores */}
              {cfMod?.authors?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={`text-xs font-semibold uppercase tracking-widest ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>Por</span>
                  {cfMod.authors.map(author => (
                    <a
                      key={author.id}
                      href={author.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition hover:scale-[1.03] ${darkMode
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/25 hover:bg-purple-500/20 hover:border-purple-400/40'
                        : 'bg-purple-100 text-purple-700 border-purple-300/60 hover:bg-purple-200'
                      }`}
                    >
                      {author.name}
                    </a>
                  ))}
                </div>
              )}

              {/* Loaders + versiones */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {livePack.modLoaders.map(l => LOADER_NAMES[l] && (
                  <span key={l} className={`px-2 py-0.5 rounded-full text-xs border font-medium ${darkMode ? (LOADER_COLORS[l] || 'bg-gray-700 text-gray-300 border-gray-600') : (LOADER_COLORS_LIGHT[l] || 'bg-gray-100 text-gray-600 border-gray-200')}`}>
                    {LOADER_NAMES[l]}
                  </span>
                ))}
                {livePack.gameVersions.slice(0, 4).map(v => (
                  <span key={v} className={`px-2 py-0.5 rounded-lg text-xs border font-mono ${darkMode ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-200/80'}`}>
                    {v}
                  </span>
                ))}
                {livePack.gameVersions.length > 4 && (
                  <span className={`text-xs self-center ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    +{livePack.gameVersions.length - 4} más
                  </span>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={downloadServerPack}
                  disabled={downloading || !localPack.serverFileId}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-900/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {downloading
                    ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" aria-hidden="true" />
                    : <Download size={15} aria-hidden="true" />
                  }
                  {downloading ? 'Obteniendo enlace...' : 'Descargar Server Pack'}
                </button>

                {localPack.serverFileId && (
                  <button
                    onClick={() => {
                      if (installStatus === 'idle' || installStatus === 'error') {
                        setInstallFileId(null);
                        const serverFile = files.find(f => (f.serverPackFileId ?? f.id) === localPack.serverFileId);
                        setInstallFileLabel(serverFile?.displayName || serverFile?.fileName || 'Versión recomendada');
                        setServerNameInput(localPack.slug);
                        setShowInstallModal(true);
                      }
                    }}
                    disabled={installStatus === 'installing'}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                      installStatus === 'done'
                        ? 'bg-green-500/10 border-green-500/25 text-green-400'
                        : installStatus === 'error'
                        ? 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20'
                        : installStatus === 'installing'
                        ? darkMode ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-gray-100 border-gray-200 text-gray-400'
                        : darkMode ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50' : 'border-purple-400/60 text-purple-700 hover:bg-purple-50 hover:border-purple-500/70'
                    }`}
                  >
                    {installStatus === 'installing'
                      ? <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-current animate-spin" aria-hidden="true" />
                      : <Server size={15} aria-hidden="true" />
                    }
                    {installStatus === 'installing' ? 'Instalando...'
                      : installStatus === 'done'    ? '✓ Instalado'
                      : installStatus === 'error'   ? 'Error — reintentar'
                      : 'Instalar servidor'}
                  </button>
                )}

                <a
                  href={`https://www.curseforge.com/minecraft/modpacks/${localPack.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
                    ? 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200 hover:bg-gray-800/50'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  CurseForge
                </a>
              </div>

              {(downloadError || (installStatus === 'error' && installError)) && (
                <p className="mt-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {downloadError || installError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatBadge label="Descargas"   value={livePack.downloadCount.toLocaleString()} darkMode={darkMode} />
          <StatBadge label="Publicado"   value={new Date(livePack.dateReleased).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} darkMode={darkMode} />
          <StatBadge label="Actualizado" value={new Date(livePack.dateModified).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} darkMode={darkMode} />
          <StatBadge label="Popularidad" value={`#${livePack.gamePopularityRank.toLocaleString()}`} darkMode={darkMode} />
        </div>

        {/* ── Pestañas ─────────────────────────────────────────────────────── */}
        <div
          className={`flex gap-1 p-1 rounded-2xl border mb-4 ${darkMode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-white border-gray-200 shadow-sm'}`}
          role="tablist"
        >
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
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${tab === t.id
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                : darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Contenido de pestaña ─────────────────────────────────────────── */}
        <section className={`rounded-2xl border p-5 sm:p-6 ${cardClass}`}>

          {/* Descripción */}
          {tab === 'descripcion' && (
            loadingDesc ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`h-3.5 rounded-lg animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-200'}`} style={{ width: `${92 - i * 8}%` }} />
                ))}
              </div>
            ) : description ? (
              <DescriptionHTML html={description} darkMode={darkMode} />
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Sin descripción disponible.</p>
            )
          )}

          {/* Screenshots */}
          {tab === 'screenshots' && (
            !cfMod?.screenshots?.length ? (
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>No hay screenshots disponibles.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cfMod.screenshots.map(ss => (
                  <button
                    key={ss.id}
                    onClick={() => setLightbox(ss.url || ss.thumbnailUrl)}
                    className={`aspect-video overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-xl group ${darkMode
                      ? 'border-purple-500/20 hover:border-purple-400/50'
                      : 'border-purple-200/60 hover:border-purple-300'
                    }`}
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
                <p className={`text-xs mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{filesTotalCount.toLocaleString()}</span> archivos · página {filesPage + 1} de {Math.ceil(filesTotalCount / 50)}
                </p>
              )}

              {loadingFiles ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`h-10 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-200'}`} />
                  ))}
                </div>
              ) : files.filter(f => f.serverPackFileId || f.isServerPack).length === 0 ? (
                <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>No hay server packs disponibles en esta página.</p>
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
                      {files.filter(f => f.serverPackFileId || f.isServerPack).map(file => (
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
                                onClick={() => downloadFile(file.serverPackFileId ?? file.id)}
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
                                onClick={() => {
                                  setInstallFileId(file.serverPackFileId ?? file.id);
                                  setInstallFileLabel(file.displayName || file.fileName);
                                  setServerNameInput(localPack.slug);
                                  setShowInstallModal(true);
                                }}
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

              {filesTotalCount > 50 && (
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
                    {filesPage + 1} / {Math.ceil(filesTotalCount / 50)}
                  </span>
                  <button
                    onClick={() => setFilesPage(p => Math.min(Math.ceil(filesTotalCount / 50) - 1, p + 1))}
                    disabled={filesPage >= Math.ceil(filesTotalCount / 50) - 1}
                    className={`p-2 rounded-xl border transition-all ${filesPage >= Math.ceil(filesTotalCount / 50) - 1
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
          )}
        </section>
      </div>

      {/* ── Modal instalación ────────────────────────────────────────────────── */}
      {showInstallModal && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowInstallModal(false)} />
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
                    <Server size={14} className="text-purple-400" />
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Instalar servidor</h3>
                </div>
                <button
                  onClick={() => setShowInstallModal(false)}
                  className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <X size={15} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-4">
                {installFileLabel && (
                  <p className={`text-xs px-3 py-2 rounded-xl border font-mono ${darkMode ? 'bg-gray-950 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                    <span className={`font-sans font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Versión: </span>
                    {installFileLabel}
                  </p>
                )}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Nombre del servidor
                  </label>
                  <input
                    type="text"
                    value={serverNameInput}
                    onChange={e => setServerNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') startInstall(); }}
                    placeholder="nombre-del-servidor"
                    autoFocus
                    className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode
                      ? 'bg-gray-950 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
                      : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
                    }`}
                  />
                </div>
              </div>
              <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button
                  onClick={() => setShowInstallModal(false)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={startInstall}
                  disabled={!serverNameInput.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-900/20"
                >
                  <Server size={14} />
                  Instalar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightbox && (
        <>
          <div
            className="fixed inset-0 bg-black/80 z-50"
            onClick={() => setLightbox(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="relative max-w-4xl w-full pointer-events-auto">
              <button
                onClick={() => setLightbox(null)}
                className={`absolute -top-10 right-0 flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl transition-colors ${darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/60' : 'text-gray-300 hover:text-white'}`}
                aria-label="Cerrar imagen"
              >
                <X size={14} /> Cerrar
              </button>
              <img
                src={lightbox}
                alt="Screenshot en grande"
                className="w-full rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
