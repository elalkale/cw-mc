import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Lightbox({ src, onClose, darkMode }) {
  useEffect(() => {
    if (!src) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative max-w-4xl w-full pointer-events-auto">
          <button
            onClick={onClose}
            className={`absolute -top-10 right-0 flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl transition-colors ${darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-800/60' : 'text-gray-300 hover:text-white'}`}
            aria-label="Cerrar imagen"
          >
            <X size={14} /> Cerrar
          </button>
          <img
            src={src}
            alt="Screenshot en grande"
            className="w-full rounded-2xl shadow-2xl"
          />
        </div>
      </div>
    </>
  );
}
