import React from 'react';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Star } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api.js';
import modpacksData from '../resources/modpacks_with_server.json';
import categoriesData from '../resources/categories.json';

// ── Tablas estáticas ──────────────────────────────────────────────────────────

const CATEGORY_MAP = Object.fromEntries(categoriesData.map(c => [c.id, c.name]));

const LOADER_NAMES = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };
const LOADER_COLORS = {
  1: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  4: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  5: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  6: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

// Versiones únicas ordenadas de mayor a menor
const ALL_VERSIONS = [...new Set(modpacksData.flatMap(m => m.gameVersions))].sort((a, b) => {
  const parse = v => v.split('.').map(Number);
  const [ma, na, pa = 0] = parse(a);
  const [mb, nb, pb = 0] = parse(b);
  return mb - ma || nb - na || pb - pa;
});

// Categorías únicas que aparecen en los modpacks, con nombre legible
const usedCategoryIds = new Set(modpacksData.flatMap(m => m.categories));
const ALL_CATEGORIES = [...usedCategoryIds]
  .filter(id => CATEGORY_MAP[id])
  .map(id => ({ id, name: CATEGORY_MAP[id] }))
  .sort((a, b) => a.name.localeCompare(b.name));

const PAGE_SIZE = 24;

// ── Tarjeta individual ────────────────────────────────────────────────────────

function ModpackCard({ pack, cfMod, darkMode, onClick }) {
  const border = darkMode
    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/20 hover:border-purple-400/50'
    : 'bg-gradient-to-br from-white to-gray-100 border-purple-400/40 hover:border-purple-500/60';

  return (
    <article
      className={`rounded-2xl border cursor-pointer transition-all overflow-hidden flex flex-col shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${border}`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalle de ${pack.name}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-900/50 relative overflow-hidden flex-shrink-0">
        {cfMod?.logo?.thumbnailUrl ? (
          <img
            src={cfMod.logo.thumbnailUrl}
            alt={`Logo de ${pack.name}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-20">📦</span>
          </div>
        )}
        {pack.isFeatured && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500 text-yellow-900">
            <Star size={10} /> Destacado
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3 className={`font-bold text-sm leading-tight line-clamp-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {pack.name}
        </h3>

        {cfMod?.summary ? (
          <p className={`text-xs line-clamp-2 flex-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {cfMod.summary}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        {/* Versiones */}
        <div className="flex flex-wrap gap-1">
          {pack.gameVersions.slice(0, 3).map(v => (
            <span
              key={v}
              className={`px-1.5 py-0.5 rounded text-xs border ${darkMode
                ? 'bg-gray-700/50 text-gray-300 border-gray-600'
                : 'bg-gray-200 text-gray-700 border-gray-300'
              }`}
            >
              {v}
            </span>
          ))}
          {pack.gameVersions.length > 3 && (
            <span className="px-1.5 py-0.5 text-xs text-gray-500">+{pack.gameVersions.length - 3}</span>
          )}
        </div>

        {/* Loaders */}
        <div className="flex flex-wrap gap-1">
          {pack.modLoaders.map(l => LOADER_NAMES[l] && (
            <span
              key={l}
              className={`px-1.5 py-0.5 rounded-full text-xs border ${LOADER_COLORS[l] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}
            >
              {LOADER_NAMES[l]}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between text-xs pt-2 border-t ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
          <span className="flex items-center gap-1">
            <Download size={11} /> {pack.downloadCount.toLocaleString()}
          </span>
          <span>
            {new Date(pack.dateModified).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
    </article>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ServerCatalog({ darkMode }) {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedLoader, setSelectedLoader] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('downloads');
  const [page, setPage] = useState(1);

  // Cache de datos de CurseForge: modId → objeto mod
  const [cfCache, setCfCache] = useState({});
  // IDs ya solicitados al API (evita duplicar peticiones al navegar entre páginas)
  const fetchedIds = useRef(new Set());

  // Scroll al inicio al cambiar de página (se salta el mount inicial)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  // ── Filtrado y ordenación (solo datos locales → instantáneo) ────────────────

  const filtered = useMemo(() => {
    let list = modpacksData;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q));
    }
    if (selectedVersion) {
      list = list.filter(m => m.gameVersions.includes(selectedVersion));
    }
    if (selectedLoader) {
      const id = Number(selectedLoader);
      list = list.filter(m => m.modLoaders.includes(id));
    }
    if (selectedCategory) {
      const id = Number(selectedCategory);
      list = list.filter(m => m.categories.includes(id));
    }

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
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => { setPage(1); }, [search, selectedVersion, selectedLoader, selectedCategory, sortBy]);

  // ── Fetch batch CurseForge solo para la página visible ──────────────────────

  const pageKey = paginated.map(m => m.modId).join(',');

  useEffect(() => {
    if (!pageKey) return;
    const missing = pageKey
      .split(',')
      .map(Number)
      .filter(id => !fetchedIds.current.has(id));

    if (missing.length === 0) return;
    missing.forEach(id => fetchedIds.current.add(id));

    fetchWithToken(`${API_BASE}/api/curseforge/mods`, {
      method: 'POST',
      body: JSON.stringify({ modIds: missing }),
    })
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

  // ── Clases compartidas ──────────────────────────────────────────────────────

  const containerClass = darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900';
  const selectClass = `px-3 py-2 rounded-lg border text-sm transition focus:outline-none focus:ring-1 focus:ring-purple-500 ${darkMode
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-300 text-gray-900'
  }`;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`max-w-7xl mx-auto mt-2 md:mt-6 px-4 md:px-6 pb-12 transition-colors ${containerClass}`}>

      {/* Cabecera */}
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
          Catálogo de Modpacks
        </h1>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {filtered.length.toLocaleString()} modpacks con server pack disponible
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar modpack..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${selectClass} w-full pl-9`}
            aria-label="Buscar modpack por nombre"
          />
        </div>

        <select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)} className={selectClass} aria-label="Filtrar por versión">
          <option value="">Todas las versiones</option>
          {ALL_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        <select value={selectedLoader} onChange={e => setSelectedLoader(e.target.value)} className={selectClass} aria-label="Filtrar por mod loader">
          <option value="">Todos los loaders</option>
          {Object.entries(LOADER_NAMES).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className={selectClass} aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          {ALL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={selectClass} aria-label="Ordenar por">
          <option value="downloads">Más descargados</option>
          <option value="popularity">Popularidad</option>
          <option value="date">Más recientes</option>
          <option value="name">Nombre A–Z</option>
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className={`text-center py-20 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} role="status">
          No se encontraron modpacks con los filtros actuales.
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

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${page === 1
              ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`
              : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            ← Anterior
          </button>
          <span className={`text-sm tabular-nums ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${page === totalPages
              ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`
              : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
