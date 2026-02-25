import React from 'react';

export default function ScreenshotsTab({ screenshots, onOpenLightbox, darkMode }) {
  if (!screenshots?.length) {
    return <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>No hay screenshots disponibles.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {screenshots.map(ss => (
        <button
          key={ss.id}
          onClick={() => onOpenLightbox(ss.url || ss.thumbnailUrl)}
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
  );
}
