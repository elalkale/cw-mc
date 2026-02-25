import React from 'react';

export default function StatBadge({ label, value, darkMode }) {
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
