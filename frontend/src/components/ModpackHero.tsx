import React from 'react';
import { Download, ExternalLink, Server, Star } from 'lucide-react';

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

export default function ModpackHero({
  cfMod, livePack, localPack, loadingMod, darkMode, cardClass,
  downloading, onDownloadServerPack, downloadError,
  installStatus, installError,
  files, onOpenInstallModal,
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden mb-5 ${cardClass}`}>

      {/* Banner */}
      <div className="h-20 sm:h-24 relative overflow-hidden flex-shrink-0 z-0">
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
      <div className="px-5 pb-5 -mt-4 sm:-mt-5 flex flex-col sm:flex-row gap-4 sm:gap-5 relative z-10">

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
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-1.5 leading-tight bg-gradient-to-r bg-clip-text text-transparent ${darkMode ? 'from-purple-300 via-pink-300 to-purple-200' : 'from-purple-700 via-pink-600 to-purple-600'}`}>
            {localPack.name}
          </h1>

          {cfMod?.summary && (
            <p className={`text-sm mb-3 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {cfMod.summary}
            </p>
          )}

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

          {/* Loaders + versions */}
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

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onDownloadServerPack}
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
                    const serverFile = files.find(f => (f.serverPackFileId ?? f.id) === localPack.serverFileId);
                    const fileLabel = serverFile?.displayName || serverFile?.fileName || 'Versión recomendada';
                    onOpenInstallModal(null, fileLabel, localPack.slug, serverFile?.gameVersions ?? []);
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
  );
}
