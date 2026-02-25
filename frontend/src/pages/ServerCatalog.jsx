import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Star, ChevronDown, Tag, Layers, LayoutGrid, ArrowUpDown, BookOpen, PackageSearch } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api.js';
import modpacksData from '../resources/modpacks_with_server.json';
import categoriesData from '../resources/categories.json';

// ── Tablas estáticas ──────────────────────────────────────────────────────────

const CATEGORY_MAP = Object.fromEntries(categoriesData.map(c => [c.id, c.name]));

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

const ALL_VERSIONS = [...new Set(modpacksData.flatMap(m => m.gameVersions))].sort((a, b) => {
  const parse = v => v.split('.').map(Number);
  const [ma, na, pa = 0] = parse(a);
  const [mb, nb, pb = 0] = parse(b);
  return mb - ma || nb - na || pb - pa;
});

const usedCategoryIds = new Set(modpacksData.flatMap(m => m.categories));
const ALL_CATEGORIES  = [...usedCategoryIds]
  .filter(id => CATEGORY_MAP[id])
  .map(id => ({ id, name: CATEGORY_MAP[id] }))
  .sort((a, b) => a.name.localeCompare(b.name));

const PAGE_SIZE = 24;

const VERSION_OPTIONS  = [{ value: '', label: 'Todas las versiones' }, ...ALL_VERSIONS.map(v => ({ value: v, label: v }))];
const LOADER_OPTIONS   = [{ value: '', label: 'Todos los loaders' },   ...Object.entries(LOADER_NAMES).map(([id, name]) => ({ value: id, label: name }))];
const CATEGORY_OPTIONS = [{ value: '', label: 'Todas las categorías' }, ...ALL_CATEGORIES.map(c => ({ value: String(c.id), label: c.name }))];
const SORT_OPTIONS     = [
  { value: 'downloads',  label: 'Más descargados' },
  { value: 'popularity', label: 'Popularidad'      },
  { value: 'date',       label: 'Más recientes'    },
  { value: 'name',       label: 'Nombre A–Z'       },
];

// ── Dropdown personalizado ────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, placeholder, icon: Icon, darkMode }) {
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

// ── Tarjeta individual ────────────────────────────────────────────────────────

function ModpackCard({ pack, cfMod, darkMode, onClick }) {
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

        {/* Loaders */}
        {pack.modLoaders.length > 0 && (
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
          {pack.gameVersions.slice(0, 3).map(v => (
            <span key={v} className={`px-1.5 py-0.5 rounded-lg text-xs border font-mono ${darkMode ? 'bg-gray-700/50 text-gray-400 border-gray-600/50' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {v}
            </span>
          ))}
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

// ── Componente principal ──────────────────────────────────────────────────────

export default function ServerCatalog({ darkMode }) {
  const navigate = useNavigate();

  const [search,           setSearch]           = useState('');
  const [selectedVersion,  setSelectedVersion]  = useState('');
  const [selectedLoader,   setSelectedLoader]   = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy,           setSortBy]           = useState('downloads');
  const [page,             setPage]             = useState(1);

  const [cfCache,    setCfCache]    = useState({});
  const fetchedIds = useRef(new Set());
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const filtered = useMemo(() => {
    let list = modpacksData;
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(m => m.name.toLowerCase().includes(q)); }
    if (selectedVersion)  list = list.filter(m => m.gameVersions.includes(selectedVersion));
    if (selectedLoader)   list = list.filter(m => m.modLoaders.includes(Number(selectedLoader)));
    if (selectedCategory) list = list.filter(m => m.categories.includes(Number(selectedCategory)));
    const sorted = [...list];
    switch (sortBy) {
      case 'downloads':  sorted.sort((a, b) => b.downloadCount - a.downloadCount); break;
      case 'popularity': sorted.sort((a, b) => a.gamePopularityRank - b.gamePopularityRank); break;
      case 'date':       sorted.sort((a, b) => new Date(b.dateModified) - new Date(a.dateModified)); break;
      case 'name':       sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return sorted;
  }, [search, selectedVersion, selectedLoader, selectedCategory, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => { setPage(1); }, [search, selectedVersion, selectedLoader, selectedCategory, sortBy]);

  const pageKey = paginated.map(m => m.modId).join(',');
  useEffect(() => {
    if (!pageKey) return;
    const missing = pageKey.split(',').map(Number).filter(id => !fetchedIds.current.has(id));
    if (missing.length === 0) return;
    missing.forEach(id => fetchedIds.current.add(id));
    fetchWithToken(`${API_BASE}/api/curseforge/mods`, { method: 'POST', body: JSON.stringify({ modIds: missing }) })
      .then(r => r.json())
      .then(data => {
        if (data?.data) {
          setCfCache(prev => {
            const next = { ...prev };
            for (const mod of data.data) next[mod.id] = mod;
            return next;
          });
        }
      })
      .catch(console.error);
  }, [pageKey]);

  const hasFilters = search || selectedVersion || selectedLoader || selectedCategory;

  const bg = darkMode
    ? "bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]"
    : "bg-[radial-gradient(ellipse_at_top,_#ede9fe_0%,_#f9f9ff_55%,_#faf5ff_100%)]";

  return (
    <div className={`min-h-screen relative transition-colors duration-300 ${bg}`}>

      {/* Blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 ${darkMode ? "bg-purple-600" : "bg-purple-400"}`} />
        <div className={`absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 ${darkMode ? "bg-pink-600" : "bg-pink-400"}`} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-16">

        {/* ── Header ───────────────────────────────────────────────────────────── */}
        <div className="mb-7">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${darkMode ? "bg-purple-500/10 border-purple-500/25 text-purple-300" : "bg-purple-100 border-purple-300/60 text-purple-700"}`}>
            <BookOpen size={11} />
            CurseForge
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
            Catálogo de Modpacks
          </h1>
          <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            <span className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{filtered.length.toLocaleString()}</span> modpacks con server pack disponible
          </p>
        </div>

        {/* ── Filtros ──────────────────────────────────────────────────────────── */}
        <div className={`flex flex-col sm:flex-row flex-wrap gap-2.5 mb-6 p-3 rounded-2xl border ${darkMode ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white/70 border-gray-200/80 shadow-sm'}`}>
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar modpack..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm transition-all focus:outline-none ${darkMode
                ? 'bg-gray-800/80 border-gray-700/80 text-gray-200 placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-400 focus:ring-1 focus:ring-purple-300/30'
              }`}
              aria-label="Buscar modpack por nombre"
            />
          </div>

          <FilterSelect value={selectedVersion}  onChange={setSelectedVersion}  options={VERSION_OPTIONS}  placeholder="Versión"   icon={Tag}       darkMode={darkMode} />
          <FilterSelect value={selectedLoader}   onChange={setSelectedLoader}   options={LOADER_OPTIONS}   placeholder="Loader"    icon={Layers}    darkMode={darkMode} />
          <FilterSelect value={selectedCategory} onChange={setSelectedCategory} options={CATEGORY_OPTIONS} placeholder="Categoría" icon={LayoutGrid} darkMode={darkMode} />
          <FilterSelect value={sortBy}           onChange={setSortBy}           options={SORT_OPTIONS}     placeholder="Ordenar"   icon={ArrowUpDown} darkMode={darkMode} />
        </div>

        {/* ── Grid ─────────────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-24 gap-4 ${darkMode ? "text-gray-600" : "text-gray-400"}`} role="status">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${darkMode ? "bg-gray-800/60 border border-gray-700/60" : "bg-white border border-gray-200 shadow-sm"}`}>
              <PackageSearch size={28} className={darkMode ? "text-gray-600" : "text-gray-400"} />
            </div>
            <div className="text-center">
              <p className={`font-semibold text-sm mb-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Sin resultados</p>
              <p className="text-xs">Prueba con otros filtros o un término de búsqueda diferente.</p>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setSelectedVersion(''); setSelectedLoader(''); setSelectedCategory(''); }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${darkMode ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map(pack => (
              <ModpackCard
                key={pack.modId}
                pack={pack}
                cfMod={cfCache[pack.modId]}
                darkMode={darkMode}
                onClick={() => navigate(`/catalog/${pack.modId}`)}
              />
            ))}
          </div>
        )}

        {/* ── Paginación ───────────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${page === 1
                ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-gray-100 text-gray-400 border border-gray-200'}`
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-900/20 hover:scale-[1.02] active:scale-95'
              }`}
            >
              ← Anterior
            </button>

            <span className={`text-sm tabular-nums px-3 py-1.5 rounded-lg border ${darkMode ? 'bg-gray-800/60 border-gray-700/60 text-gray-400' : 'bg-white border-gray-200 text-gray-500 shadow-sm'}`}>
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${page === totalPages
                ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-gray-100 text-gray-400 border border-gray-200'}`
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-900/20 hover:scale-[1.02] active:scale-95'
              }`}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
