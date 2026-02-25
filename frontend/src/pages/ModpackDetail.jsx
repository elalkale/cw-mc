import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api.js';
import modpacksData from '../resources/modpacks_with_server.json';

const LOADER_NAMES = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };
const LOADER_COLORS = {
  1: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  4: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  5: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  6: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

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
  const [description, setDescription] = useState('');
  const [loadingMod, setLoadingMod] = useState(true);
  const [loadingDesc, setLoadingDesc] = useState(true);

  // Descarga
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

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

  // Cerrar lightbox con Escape
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e) => { if (e.key === 'Escape') setLightbox(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightbox]);

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
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent mb-2 leading-tight">
            {localPack.name}
          </h1>

          {cfMod?.summary && (
            <p className={`text-sm mb-4 leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {cfMod.summary}
            </p>
          )}

          {/* Loaders */}
          <div className="flex flex-wrap gap-2 mb-4">
            {localPack.modLoaders.map(l => LOADER_NAMES[l] && (
              <span key={l} className={`px-2 py-0.5 rounded-full text-xs border font-medium ${LOADER_COLORS[l] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
                {LOADER_NAMES[l]}
              </span>
            ))}
            {localPack.gameVersions.slice(0, 4).map(v => (
              <span key={v} className={`px-2 py-0.5 rounded text-xs border ${darkMode ? 'bg-gray-700/50 text-gray-300 border-gray-600' : 'bg-gray-200 text-gray-700 border-gray-300'}`}>
                {v}
              </span>
            ))}
            {localPack.gameVersions.length > 4 && (
              <span className="text-xs text-gray-500 self-center">+{localPack.gameVersions.length - 4} más</span>
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
        <StatBadge label="Descargas" value={localPack.downloadCount.toLocaleString()} darkMode={darkMode} />
        <StatBadge label="Publicado" value={new Date(localPack.dateReleased).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} darkMode={darkMode} />
        <StatBadge label="Actualizado" value={new Date(localPack.dateModified).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} darkMode={darkMode} />
        <StatBadge label="Popularidad" value={`#${localPack.gamePopularityRank.toLocaleString()}`} darkMode={darkMode} />
      </div>

      {/* Screenshots */}
      {cfMod?.screenshots?.length > 0 && (
        <section className={`${cardClass} mb-6`}>
          <h2 className={`text-lg font-bold mb-4 ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
            Screenshots
          </h2>
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
        </section>
      )}

      {/* Descripción HTML */}
      <section className={cardClass}>
        <h2 className={`text-lg font-bold mb-4 ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
          Descripción
        </h2>
        {loadingDesc ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 rounded bg-gray-700/50 animate-pulse" style={{ width: `${85 - i * 10}%` }} />
            ))}
          </div>
        ) : description ? (
          <div
            className={`prose prose-sm max-w-none ${darkMode ? 'prose-invert' : ''} [&_img]:rounded-lg [&_img]:max-w-full [&_a]:text-purple-400`}
            dangerouslySetInnerHTML={{ __html: description }}
          />
        ) : (
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Sin descripción disponible.</p>
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
