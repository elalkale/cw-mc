import React from 'react';
import { Download, Star } from 'lucide-react';

const LOADER_NAMES  = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };
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

export default function ModpackCard({ pack, cfMod, darkMode, onClick }) {
  return (
    <article
      className={`rounded-2xl border cursor-pointer transition-all overflow-hidden flex flex-col shadow-md hover:shadow-xl hover:-translate-y-0.5 ${darkMode
        ? 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/25 hover:border-purple-400/50'
        : 'bg-gradient-to-br from-white to-purple-50/60 border-purple-200/60 hover:border-purple-300/80'
      }`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalle de ${pack.name}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden flex-shrink-0 rounded-t-2xl">
        {cfMod?.logo?.thumbnailUrl ? (
          <img src={cfMod.logo.thumbnailUrl} alt={`Logo de ${pack.name}`} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className={`w-full h-full ${darkMode
            ? 'bg-gradient-to-br from-purple-900/70 via-indigo-900/40 to-pink-900/60'
            : 'bg-gradient-to-br from-purple-200/80 via-indigo-100 to-pink-200/80'
          }`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent" />
        {pack.isFeatured && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-400/90 text-yellow-900 shadow-sm">
            <Star size={9} fill="currentColor" /> Destacado
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="px-3.5 pb-3.5 pt-3 flex flex-col flex-1 gap-2">
        <h3 className={`font-bold text-sm leading-tight line-clamp-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {pack.name}
        </h3>

        {cfMod?.summary && (
          <p className={`text-xs line-clamp-2 flex-1 leading-relaxed ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            {cfMod.summary}
          </p>
        )}

        {/* Loaders (solo si no hay versionInfo) */}
        {!pack.versionInfo && pack.modLoaders.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pack.modLoaders.map(l => LOADER_NAMES[l] && (
              <span key={l} className={`px-1.5 py-0.5 rounded-full text-xs border ${darkMode ? (LOADER_COLORS[l] || 'bg-gray-500/15 text-gray-300 border-gray-500/25') : (LOADER_COLORS_LIGHT[l] || 'bg-gray-100 text-gray-600 border-gray-200')}`}>
                {LOADER_NAMES[l]}
              </span>
            ))}
          </div>
        )}

        {/* Versiones */}
        <div className="flex flex-wrap gap-1">
          {pack.gameVersions.slice(0, 3).map(v => {
            const info = pack.versionInfo?.[v];
            const isBeta  = info?.releaseType === 2;
            const isAlpha = info?.releaseType === 3;
            const loaderNames = (info?.loaders ?? []).map(l => LOADER_NAMES[l]).filter(Boolean);
            return (
              <span key={v} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs border font-mono ${darkMode ? 'bg-gray-700/50 text-gray-400 border-gray-600/50' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {v}
                {isBeta  && <span className={`text-[10px] font-bold not-italic ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>β</span>}
                {isAlpha && <span className={`text-[10px] font-bold not-italic ${darkMode ? 'text-red-400' : 'text-red-500'}`}>α</span>}
                {loaderNames.length > 0 && (
                  <span className={`text-[9px] font-semibold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {loaderNames.join('/')}
                  </span>
                )}
              </span>
            );
          })}
          {pack.gameVersions.length > 3 && (
            <span className={`px-1.5 py-0.5 text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              +{pack.gameVersions.length - 3}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between text-xs pt-2 border-t ${darkMode ? 'border-gray-700/50 text-gray-500' : 'border-gray-200/80 text-gray-400'}`}>
          <span className="flex items-center gap-1">
            <Download size={10} /> {pack.downloadCount.toLocaleString()}
          </span>
          <span>{new Date(pack.dateModified).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
    </article>
  );
}
