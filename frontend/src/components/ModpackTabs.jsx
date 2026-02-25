import React from 'react';

export default function ModpackTabs({ tab, onTabChange, cfMod, filesTotalCount, darkMode }) {
  const tabs = [
    { id: 'descripcion', label: 'Descripción' },
    { id: 'screenshots', label: `Screenshots${cfMod?.screenshots?.length ? ` (${cfMod.screenshots.length})` : ''}` },
    { id: 'versiones',   label: `Versiones${filesTotalCount ? ` (${filesTotalCount})` : ''}` },
  ];

  return (
    <div
      className={`flex gap-1 p-1 rounded-2xl border mb-4 ${darkMode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-white border-gray-200 shadow-sm'}`}
      role="tablist"
    >
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onTabChange(t.id)}
          className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${tab === t.id
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
            : darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100/80'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
