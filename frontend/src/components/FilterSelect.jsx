import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export default function FilterSelect({ value, onChange, options, placeholder, icon: Icon, darkMode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected  = options.find(o => String(o.value) === String(value));
  const isDefault = !value;

  return (
    <div ref={ref} className="relative" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all whitespace-nowrap select-none ${
          darkMode
            ? `bg-gray-800/80 border-gray-700/80 hover:bg-gray-800 ${open ? 'border-purple-500/50 ring-1 ring-purple-500/20' : ''} ${isDefault ? 'text-gray-500' : 'text-gray-200'}`
            : `bg-white border-gray-200 hover:bg-gray-50 shadow-sm ${open ? 'border-purple-400 ring-1 ring-purple-300/30' : ''} ${isDefault ? 'text-gray-400' : 'text-gray-800'}`
        }`}
      >
        {Icon && <Icon size={13} className={`shrink-0 ${isDefault ? (darkMode ? 'text-gray-600' : 'text-gray-400') : 'text-purple-400'}`} />}
        <span className="truncate max-w-[130px]">{selected?.label ?? placeholder}</span>
        <ChevronDown size={13} className={`shrink-0 ml-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
      </button>

      {open && (
        <div className={`absolute top-full mt-2 z-50 min-w-full w-max max-w-[240px] max-h-64 overflow-y-auto rounded-xl border custom-scrollbar ${
          darkMode ? 'bg-gray-800 border-gray-700/60 shadow-2xl shadow-black/50' : 'bg-white border-gray-200 shadow-xl'
        }`}>
          <div className="py-1">
            {options.map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  String(opt.value) === String(value)
                    ? darkMode ? 'bg-purple-600/20 text-purple-300 font-medium' : 'bg-purple-50 text-purple-700 font-medium'
                    : opt.value === ''
                      ? darkMode ? 'text-gray-500 hover:bg-gray-700/40' : 'text-gray-400 hover:bg-gray-50'
                      : darkMode ? 'text-gray-300 hover:bg-gray-700/60 hover:text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
