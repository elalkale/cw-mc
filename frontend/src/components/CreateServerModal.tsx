import React, { useState, useEffect, useMemo } from 'react';
import { X, Server, Download, Zap, Loader2 } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api';
import FilterSelect from './FilterSelect';

const MODLOADERS = [
  { value: 'vanilla', label: 'Vanilla' },
  { value: 'forge', label: 'Forge' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'quilt', label: 'Quilt' },
  { value: 'neoforge', label: 'NeoForge' },
];

const MODLOADER_OPTIONS = MODLOADERS;
const RAM_OPTIONS = [
  { value: '512', label: '512 MB' },
  { value: '1024', label: '1 GB' },
  { value: '2048', label: '2 GB' },
  { value: '4096', label: '4 GB' },
  { value: '6144', label: '6 GB' },
  { value: '8192', label: '8 GB' },
];

export default function CreateServerModal({ isOpen, onClose, darkMode, onServerCreated }) {
  const [serverName, setServerName] = useState('');
  const [modLoader, setModLoader] = useState('fabric');
  const [mcVersion, setMcVersion] = useState('');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [ramMb, setRamMb] = useState('2048');
  const [customRam, setCustomRam] = useState('');
  const [useCustomRam, setUseCustomRam] = useState(false);
  const [jvmArgs, setJvmArgs] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Estados para carga dinámica
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Cargar versiones de MC cuando cambia el modloader
  useEffect(() => {
    const loadMcVersions = async () => {
      setLoadingVersions(true);
      setMcVersions([]);
      setMcVersion('');
      setLoaderVersion('');
      setLoaderVersions([]);

      try {
        const res = await fetchWithToken(`${API_BASE}/api/servers/versions?modLoader=${modLoader}`);
        const data = await res.json();
        if (data.versions && Array.isArray(data.versions)) {
          setMcVersions(data.versions);
          if (data.versions.length > 0) {
            setMcVersion(data.versions[0]);
          }
        }
      } catch (err) {
        console.error('Error loading MC versions:', err);
        setError('Error cargando versiones disponibles');
      } finally {
        setLoadingVersions(false);
      }
    };

    if (isOpen) {
      loadMcVersions();
    }
  }, [modLoader, isOpen]);

  // Cargar versiones del loader cuando cambia la versión MC
  useEffect(() => {
    const loadLoaderVersions = async () => {
      if (!mcVersion || modLoader === 'vanilla') {
        setLoaderVersions([]);
        setLoaderVersion('');
        return;
      }

      setLoadingVersions(true);
      try {
        const res = await fetchWithToken(`${API_BASE}/api/servers/loaderVersions?modLoader=${modLoader}&mcVersion=${mcVersion}`);
        const data = await res.json();
        if (data.versions && Array.isArray(data.versions)) {
          setLoaderVersions(data.versions);
          if (data.versions.length > 0) {
            setLoaderVersion(data.versions[0]);
          }
        }
      } catch (err) {
        console.error('Error loading loader versions:', err);
      } finally {
        setLoadingVersions(false);
      }
    };

    if (isOpen) {
      loadLoaderVersions();
    }
  }, [mcVersion, modLoader, isOpen]);

  const handleCreate = async () => {
    if (!serverName.trim()) {
      setError('El nombre del servidor no puede estar vacío');
      return;
    }

    if (!mcVersion) {
      setError('Selecciona una versión de Minecraft');
      return;
    }

    if (modLoader !== 'vanilla' && !loaderVersion) {
      setError('Selecciona una versión del modloader');
      return;
    }

    const ram = useCustomRam ? customRam : ramMb;
    if (!ram || isNaN(Number(ram)) || Number(ram) < 256) {
      setError('La RAM debe ser por lo menos 256 MB');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const res = await fetchWithToken(`${API_BASE}/api/servers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serverName.trim(),
          version: mcVersion,
          modLoader,
          loaderVersion: modLoader === 'vanilla' ? undefined : loaderVersion,
          ram: Number(ram),
          jvmArgs: jvmArgs.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear el servidor');

      setServerName('');
      setMcVersion('');
      setModLoader('fabric');
      setLoaderVersion('');
      setRamMb('2048');
      setCustomRam('');
      setUseCustomRam(false);
      setJvmArgs('');
      
      onClose();
      if (onServerCreated) onServerCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const versionOptions = mcVersions.map(v => ({ value: v, label: v }));
  const loaderVersionOptions = loaderVersions.map(v => ({ value: v, label: v }));

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
        <div
          className={`w-full max-w-md rounded-2xl shadow-2xl border pointer-events-auto max-h-[90vh] overflow-y-auto ${darkMode
            ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30'
            : 'bg-white border-purple-200/70'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 ${darkMode ? 'border-gray-700/60 bg-gray-800/95' : 'border-gray-200 bg-white/95'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
                <Zap size={14} className="text-purple-400" />
              </div>
              <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Crear Servidor</h3>
            </div>
            <button
              onClick={onClose}
              disabled={creating}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <X size={15} />
            </button>
          </div>

          {/* ── Content ─────────────────────────────────────────────────────── */}
          <div className="px-5 py-4 space-y-4">
            {/* Nombre del servidor */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Nombre del servidor
              </label>
              <input
                type="text"
                value={serverName}
                onChange={e => setServerName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !creating) handleCreate(); }}
                placeholder="mi-servidor"
                disabled={creating}
                className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode
                  ? 'bg-gray-950 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
                  : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
                } disabled:opacity-50`}
              />
            </div>

            {/* Modloader */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Modloader
              </label>
              <FilterSelect
                value={modLoader}
                onChange={v => setModLoader(String(v))}
                options={MODLOADER_OPTIONS}
                placeholder="Selecciona modloader"
                darkMode={darkMode}
              />
            </div>

            {/* Versión de Minecraft */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Versión de Minecraft
                {loadingVersions && <span className="ml-2 text-xs text-purple-400">cargando...</span>}
              </label>
              {mcVersions.length > 0 ? (
                <FilterSelect
                  value={mcVersion}
                  onChange={v => setMcVersion(String(v))}
                  options={versionOptions}
                  placeholder="Selecciona versión"
                  darkMode={darkMode}
                />
              ) : (
                <div className={`px-3 py-2 rounded-xl border text-sm ${darkMode ? 'bg-gray-950 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {loadingVersions ? 'Cargando versiones...' : 'Sin versiones disponibles'}
                </div>
              )}
            </div>

            {/* Versión del Loader (si no es vanilla) */}
            {modLoader !== 'vanilla' && (
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Versión de {modLoader.charAt(0).toUpperCase() + modLoader.slice(1)}
                  {loadingVersions && <span className="ml-2 text-xs text-purple-400">cargando...</span>}
                </label>
                {loaderVersions.length > 0 ? (
                  <FilterSelect
                    value={loaderVersion}
                    onChange={v => setLoaderVersion(String(v))}
                    options={loaderVersionOptions}
                    placeholder={`Selecciona versión de ${modLoader}`}
                    darkMode={darkMode}
                  />
                ) : (
                  <div className={`px-3 py-2 rounded-xl border text-sm ${darkMode ? 'bg-gray-950 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                    {loadingVersions ? 'Cargando versiones...' : 'Sin versiones disponibles'}
                  </div>
                )}
              </div>
            )}

            {/* RAM */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Memoria RAM
              </label>
              {!useCustomRam ? (
                <div className="space-y-2">
                  <FilterSelect
                    value={ramMb}
                    onChange={v => setRamMb(String(v))}
                    options={RAM_OPTIONS}
                    placeholder="Selecciona RAM"
                    darkMode={darkMode}
                  />
                  <button
                    onClick={() => setUseCustomRam(true)}
                    disabled={creating}
                    className={`text-xs font-medium transition-colors ${darkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}
                  >
                    Especificar valor personalizado
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={customRam}
                    onChange={e => setCustomRam(e.target.value)}
                    placeholder="2048"
                    disabled={creating}
                    min="256"
                    className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode
                      ? 'bg-gray-950 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
                      : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
                    } disabled:opacity-50`}
                  />
                  <button
                    onClick={() => { setUseCustomRam(false); setCustomRam(''); }}
                    disabled={creating}
                    className={`text-xs font-medium transition-colors ${darkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}
                  >
                    Usar valores predefinidos
                  </button>
                </div>
              )}
            </div>

            {/* JVM Args (Opcional) */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Argumentos JVM (opcional)
              </label>
              <input
                type="text"
                value={jvmArgs}
                onChange={e => setJvmArgs(e.target.value)}
                placeholder="-XX:+UseG1GC -XX:MaxGCPauseMillis=200"
                disabled={creating}
                className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none text-xs font-mono ${darkMode
                  ? 'bg-gray-950 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
                  : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'
                } disabled:opacity-50 h-12`}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div className={`flex justify-end gap-2 px-5 py-4 border-t sticky bottom-0 ${darkMode ? 'border-gray-700/60 bg-gray-800/95' : 'border-gray-200 bg-white/95'}`}>
            <button
              onClick={onClose}
              disabled={creating}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} disabled:opacity-50`}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-colors disabled:opacity-60"
            >
              {creating ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Crear servidor
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
