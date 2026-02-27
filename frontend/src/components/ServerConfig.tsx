import React, { useEffect, useRef, useState } from 'react';
import {
  Coffee, CheckCircle2, AlertCircle, Download, Save,
  Server, RefreshCw, ChevronDown, Package,
} from 'lucide-react';
import { fetchWithToken } from '../lib/api';
import { API } from '../constants';
import type { JavaVersionStatus, ServerJavaConfig, ServerProperties } from '../types';

// ── Dropdown estilizado (igual que FilterSelect pero full-width) ───────────────
function ConfigSelect({ value, onChange, options, darkMode }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  darkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative w-full" onKeyDown={e => e.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm transition-all select-none ${
          darkMode
            ? `bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800 ${open ? 'border-purple-500/60 ring-1 ring-purple-500/20' : ''}`
            : `bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100 ${open ? 'border-purple-400 ring-1 ring-purple-300/30' : ''}`
        }`}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={13} aria-hidden="true" className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute top-full mt-1.5 z-50 w-full rounded-xl border overflow-hidden list-none p-0 m-0 ${
            darkMode ? 'bg-gray-800 border-gray-700/60 shadow-2xl shadow-black/50' : 'bg-white border-gray-200 shadow-xl'
          }`}
        >
          {options.map(opt => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(opt.value); setOpen(false); } }}
              tabIndex={0}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                opt.value === value
                  ? darkMode ? 'bg-purple-600/20 text-purple-300 font-medium' : 'bg-purple-50 text-purple-700 font-medium'
                  : darkMode ? 'text-gray-300 hover:bg-gray-700/60 hover:text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Versión de Java necesaria según versión de MC (replica la lógica del backend)
function getMcJavaVersion(mcVersion: string): 8 | 17 | 21 {
  if (!mcVersion || mcVersion === 'Desconocida') return 17;
  const parts = mcVersion.split('.').map(Number);
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  if (minor < 17) return 8;
  if (minor < 20 || (minor === 20 && patch <= 4)) return 17;
  return 21;
}

const GAMEMODE_OPTIONS = ['survival', 'creative', 'adventure', 'spectator'];
const DIFFICULTY_OPTIONS = ['peaceful', 'easy', 'normal', 'hard'];

interface Props {
  server: string;
  serverVersion: string;
  darkMode: boolean;
}

export default function ServerConfig({ server, serverVersion, darkMode }: Props) {
  // ── Java ─────────────────────────────────────────────────────────────────
  const [javaConfig, setJavaConfig]   = useState<ServerJavaConfig | null>(null);
  const [javaStatus, setJavaStatus]   = useState<Record<number, JavaVersionStatus>>({});
  const [javaPathInput, setJavaPathInput] = useState('');
  const [savingJava, setSavingJava]   = useState(false);
  const [javaMsg, setJavaMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const pollingRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasDownloadingRef = useRef(false);

  const requiredJava = getMcJavaVersion(serverVersion);

  // ── Ejecutable del servidor ───────────────────────────────────────────────
  const [serverJarInput, setServerJarInput] = useState('');
  const [savingJar, setSavingJar]           = useState(false);
  const [jarMsg, setJarMsg]                 = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Script de inicio ──────────────────────────────────────────────────────
  const [startScriptInput, setStartScriptInput] = useState('');
  const [savingScript, setSavingScript]         = useState(false);
  const [scriptMsg, setScriptMsg]               = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Carga config Java del servidor
  useEffect(() => {
    fetchWithToken(API.SERVER_CONFIG(server))
      .then(r => r.json())
      .then((data: ServerJavaConfig) => {
        setJavaConfig(data);
        setJavaPathInput(data.javaPath ?? '');
        setServerJarInput(data.serverJar ?? '');
        setStartScriptInput(data.startScript ?? '');
      })
      .catch(() => {});
  }, [server]);

  // Carga y refresca el estado de descarga de todos los JREs
  const fetchJavaStatus = () => {
    fetchWithToken(API.JAVA_STATUS)
      .then(r => r.json())
      .then(setJavaStatus)
      .catch(() => {});
  };

  useEffect(() => {
    fetchJavaStatus();
  }, []);

  // Polling mientras hay una descarga activa
  useEffect(() => {
    const isDownloading = Object.values(javaStatus).some(v => v.status === 'downloading');
    if (isDownloading) {
      wasDownloadingRef.current = true;
      if (!pollingRef.current) pollingRef.current = setInterval(fetchJavaStatus, 1200);
    } else {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      if (wasDownloadingRef.current) {
        wasDownloadingRef.current = false;
        // Refrescar config para actualizar managedReady
        fetchWithToken(API.SERVER_CONFIG(server))
          .then(r => r.json())
          .then((data: ServerJavaConfig) => setJavaConfig(data))
          .catch(() => {});
      }
    }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [javaStatus, server]);

  const startJavaDownload = async (ver: number) => {
    await fetchWithToken(API.JAVA_DOWNLOAD(ver), { method: 'POST' });
    fetchJavaStatus();
  };

  const saveServerJar = async () => {
    setSavingJar(true);
    setJarMsg(null);
    try {
      const res  = await fetchWithToken(API.SERVER_CONFIG(server), {
        method: 'POST',
        body: JSON.stringify({ serverJar: serverJarInput.trim() || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJavaConfig(prev => prev ? { ...prev, serverJar: serverJarInput.trim() || null } : prev);
      setJarMsg({ type: 'ok', text: 'Ejecutable guardado. Los scripts start-server.bat/.sh han sido regenerados.' });
    } catch (err: any) {
      setJarMsg({ type: 'err', text: err.message });
    } finally {
      setSavingJar(false);
    }
  };

  const saveStartScript = async () => {
    setSavingScript(true);
    setScriptMsg(null);
    try {
      const res  = await fetchWithToken(API.SERVER_CONFIG(server), {
        method: 'POST',
        body: JSON.stringify({ startScript: startScriptInput.trim() || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJavaConfig(prev => prev ? { ...prev, startScript: startScriptInput.trim() || null } : prev);
      setScriptMsg({ type: 'ok', text: 'Script guardado. Se usará al iniciar el servidor.' });
    } catch (err: any) {
      setScriptMsg({ type: 'err', text: err.message });
    } finally {
      setSavingScript(false);
    }
  };

  const saveJavaPath = async () => {
    setSavingJava(true);
    setJavaMsg(null);
    try {
      const res  = await fetchWithToken(API.SERVER_CONFIG(server), {
        method: 'POST',
        body: JSON.stringify({ javaPath: javaPathInput.trim() || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJavaMsg({ type: 'ok', text: 'Ruta guardada. Se usará en el próximo inicio.' });
    } catch (err: any) {
      setJavaMsg({ type: 'err', text: err.message });
    } finally {
      setSavingJava(false);
    }
  };

  // ── server.properties ─────────────────────────────────────────────────────
  const [props, setProps]           = useState<ServerProperties>({});
  const [propsExists, setPropsExists] = useState(true);
  const [loadingProps, setLoadingProps] = useState(true);
  const [savingProps, setSavingProps] = useState(false);
  const [propsMsg, setPropsMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setLoadingProps(true);
    fetchWithToken(API.SERVER_PROPERTIES(server))
      .then(r => r.json())
      .then(data => {
        setPropsExists(data.exists);
        setProps(data.properties ?? {});
      })
      .catch(() => setPropsExists(false))
      .finally(() => setLoadingProps(false));
  }, [server]);

  const updateProp = (key: keyof ServerProperties, value: string) => {
    setProps(prev => ({ ...prev, [key]: value }));
  };

  const saveProperties = async () => {
    setSavingProps(true);
    setPropsMsg(null);
    try {
      const res  = await fetchWithToken(API.SERVER_PROPERTIES(server), {
        method: 'POST',
        body: JSON.stringify({ properties: props }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPropsMsg({ type: 'ok', text: 'Propiedades guardadas. Reinicia el servidor para aplicarlas.' });
    } catch (err: any) {
      setPropsMsg({ type: 'err', text: err.message });
    } finally {
      setSavingProps(false);
    }
  };

  // ── Estilos compartidos ───────────────────────────────────────────────────
  const card = darkMode
    ? 'bg-gray-800/60 border-gray-700/60'
    : 'bg-white border-gray-200 shadow-sm';

  const inputCls = `w-full px-3 py-2 rounded-xl text-sm border transition-colors focus:outline-none ${darkMode
    ? 'bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60'
    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'}`;

  const labelCls = `block text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`;

  const toggleCls = (active: boolean) =>
    `relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
      active ? 'bg-purple-600' : darkMode ? 'bg-gray-600' : 'bg-gray-300'
    }`;

  const currentJavaInfo = javaStatus[requiredJava];
  const isDownloading   = currentJavaInfo?.status === 'downloading';
  const isReady         = javaConfig?.managedReady || currentJavaInfo?.ready || false;
  const managedPath     = javaConfig?.managedPath ?? null;

  return (
    <div className="space-y-5">

      {/* ── Sección Java ──────────────────────────────────────────────────── */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
            <Coffee size={14} className="text-purple-400" aria-hidden="true" />
          </div>
          <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Java
          </h3>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-lg border font-mono ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
            Java {requiredJava} requerido
          </span>
        </div>

        {/* Estado del JRE gestionado */}
        <div className={`flex items-center justify-between p-3 rounded-xl border mb-4 ${darkMode ? 'bg-gray-900/60 border-gray-700/60' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2">
            {isReady ? (
              <CheckCircle2 size={15} className="text-green-400 shrink-0" />
            ) : (
              <AlertCircle size={15} className={`shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            )}
            <div>
              <p className={`text-xs font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                JRE gestionado (Java {requiredJava})
              </p>
              {isReady && managedPath && (
                <p className={`text-xs font-mono truncate max-w-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {managedPath}
                </p>
              )}
              {!isReady && (
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No instalado</p>
              )}
            </div>
          </div>

          {!isReady && (
            <button
              onClick={() => startJavaDownload(requiredJava)}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {isDownloading
                ? <RefreshCw size={11} className="animate-spin" aria-hidden="true" />
                : <Download size={11} aria-hidden="true" />
              }
              {isDownloading ? 'Descargando...' : `Descargar Java ${requiredJava}`}
            </button>
          )}
        </div>

        {/* Barra de progreso */}
        {isDownloading && (
          <div className="mb-4">
            <div className={`flex justify-between text-xs mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <span>Descargando JRE…</span>
              <span>{currentJavaInfo.progress}%</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-500"
                style={{ width: `${currentJavaInfo.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error de descarga */}
        {currentJavaInfo?.status === 'error' && (
          <p className={`text-xs mb-4 px-3 py-2 rounded-xl border ${darkMode ? 'bg-red-500/10 border-red-500/25 text-red-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
            Error: {currentJavaInfo.error}
          </p>
        )}

        {/* Ruta personalizada */}
        <div>
          <label className={labelCls}>
            Ruta personalizada del ejecutable Java
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={javaPathInput}
              onChange={e => setJavaPathInput(e.target.value)}
              placeholder={managedPath ?? 'Ej: C:\\Java\\17\\bin\\java.exe'}
              className={inputCls}
              aria-label="Ruta personalizada de Java"
            />
            <button
              onClick={saveJavaPath}
              disabled={savingJava}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-60 shadow-sm whitespace-nowrap"
            >
              <Save size={13} aria-hidden="true" />
              Guardar
            </button>
          </div>
          <p className={`text-xs mt-1.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Déjalo vacío para usar el JRE gestionado automáticamente.
          </p>
        </div>

        {javaMsg && (
          <p className={`text-xs mt-3 px-3 py-2 rounded-xl border ${javaMsg.type === 'ok'
            ? darkMode ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
            : darkMode ? 'bg-red-500/10 border-red-500/25 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {javaMsg.text}
          </p>
        )}
      </section>

      {/* ── Sección ejecutable del servidor ───────────────────────────────── */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
            <Package size={14} className="text-purple-400" aria-hidden="true" />
          </div>
          <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Ejecutable del servidor
          </h3>
        </div>

        {/* Selector de JAR */}
        {javaConfig && javaConfig.jarFiles.length > 0 ? (
          <div className="mb-3">
            <label className={labelCls}>JAR detectado en el directorio</label>
            <ConfigSelect
              value={serverJarInput}
              onChange={v => setServerJarInput(v)}
              options={[
                { value: '', label: 'Seleccionar…' },
                ...javaConfig.jarFiles.map(f => ({ value: f, label: f })),
              ]}
              darkMode={darkMode}
            />
          </div>
        ) : (
          <div className="mb-3">
            <label className={labelCls}>Nombre del JAR</label>
            <input
              type="text"
              value={serverJarInput}
              onChange={e => setServerJarInput(e.target.value)}
              placeholder="server.jar"
              className={inputCls}
              aria-label="Nombre del archivo JAR del servidor"
            />
          </div>
        )}

        {/* Input manual (siempre visible si hay selector) */}
        {javaConfig && javaConfig.jarFiles.length > 0 && (
          <div className="mb-3">
            <label className={labelCls}>O escribe el nombre manualmente</label>
            <input
              type="text"
              value={serverJarInput}
              onChange={e => setServerJarInput(e.target.value)}
              placeholder="server.jar"
              className={inputCls}
              aria-label="Nombre manual del archivo JAR"
            />
          </div>
        )}

        <p className={`text-xs mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Se usa al generar el script de inicio automático cuando no existe <code className="font-mono">start.bat</code>/<code className="font-mono">start.sh</code>.
          Déjalo vacío para usar <code className="font-mono">server.jar</code> por defecto.
        </p>

        <button
          onClick={saveServerJar}
          disabled={savingJar}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-60 shadow-sm"
        >
          {savingJar
            ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
            : <Save size={13} aria-hidden="true" />
          }
          Guardar ejecutable
        </button>

        {jarMsg && (
          <p className={`text-xs mt-3 px-3 py-2 rounded-xl border ${jarMsg.type === 'ok'
            ? darkMode ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
            : darkMode ? 'bg-red-500/10 border-red-500/25 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {jarMsg.text}
          </p>
        )}
      </section>

      {/* ── Sección script de inicio ──────────────────────────────────────── */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
            <Server size={14} className="text-purple-400" aria-hidden="true" />
          </div>
          <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Script de inicio
          </h3>
          {javaConfig?.startScript && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-lg border font-mono truncate max-w-[160px] ${darkMode ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-200 text-green-700'}`}>
              {javaConfig.startScript}
            </span>
          )}
        </div>

        {/* Selector de scripts detectados */}
        {javaConfig && javaConfig.scriptFiles.length > 0 ? (
          <div className="mb-3">
            <label className={labelCls}>Script detectado en el directorio</label>
            <ConfigSelect
              value={startScriptInput}
              onChange={v => setStartScriptInput(v)}
              options={[
                { value: '', label: 'Auto-detectar (recomendado)' },
                ...javaConfig.scriptFiles.map(f => ({ value: f, label: f })),
              ]}
              darkMode={darkMode}
            />
          </div>
        ) : (
          <div className="mb-3">
            <label className={labelCls}>Nombre del script</label>
            <input
              type="text"
              value={startScriptInput}
              onChange={e => setStartScriptInput(e.target.value)}
              placeholder="start-server.bat"
              className={inputCls}
              aria-label="Nombre del script de inicio"
            />
          </div>
        )}

        {javaConfig && javaConfig.scriptFiles.length > 0 && (
          <div className="mb-3">
            <label className={labelCls}>O escribe el nombre manualmente</label>
            <input
              type="text"
              value={startScriptInput}
              onChange={e => setStartScriptInput(e.target.value)}
              placeholder="start-server.bat"
              className={inputCls}
              aria-label="Nombre manual del script de inicio"
            />
          </div>
        )}

        <p className={`text-xs mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Script que CW-MC ejecuta al pulsar <strong>Iniciar</strong>. Déjalo vacío para usar la auto-detección
          (prioridad: <code className="font-mono">start-server.bat</code> → <code className="font-mono">start.bat</code>).
        </p>

        <button
          onClick={saveStartScript}
          disabled={savingScript}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-60 shadow-sm"
        >
          {savingScript
            ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
            : <Save size={13} aria-hidden="true" />
          }
          Guardar script
        </button>

        {scriptMsg && (
          <p className={`text-xs mt-3 px-3 py-2 rounded-xl border ${scriptMsg.type === 'ok'
            ? darkMode ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
            : darkMode ? 'bg-red-500/10 border-red-500/25 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {scriptMsg.text}
          </p>
        )}
      </section>

      {/* ── Sección server.properties ──────────────────────────────────────── */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
            <Server size={14} className="text-purple-400" aria-hidden="true" />
          </div>
          <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Servidor
          </h3>
        </div>

        {loadingProps ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`h-9 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
            ))}
          </div>
        ) : !propsExists ? (
          <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            No se encontró <code className="font-mono">server.properties</code>. Inicia el servidor al menos una vez para generarlo.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* MOTD */}
              <div className="sm:col-span-2">
                <label className={labelCls}>MOTD (mensaje del día)</label>
                <input
                  type="text"
                  value={props.motd ?? ''}
                  onChange={e => updateProp('motd', e.target.value)}
                  placeholder="Un servidor de Minecraft"
                  className={inputCls}
                />
              </div>

              {/* Max players */}
              <div>
                <label className={labelCls}>Máx. jugadores</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={props['max-players'] ?? '20'}
                  onChange={e => updateProp('max-players', e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* View distance */}
              <div>
                <label className={labelCls}>Distancia de vista (chunks)</label>
                <input
                  type="number"
                  min={2}
                  max={32}
                  value={props['view-distance'] ?? '10'}
                  onChange={e => updateProp('view-distance', e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Gamemode */}
              <div>
                <label className={labelCls}>Modo de juego</label>
                <ConfigSelect
                  value={props.gamemode ?? 'survival'}
                  onChange={v => updateProp('gamemode', v)}
                  options={GAMEMODE_OPTIONS.map(m => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))}
                  darkMode={darkMode}
                />
              </div>

              {/* Difficulty */}
              <div>
                <label className={labelCls}>Dificultad</label>
                <ConfigSelect
                  value={props.difficulty ?? 'easy'}
                  onChange={v => updateProp('difficulty', v)}
                  options={DIFFICULTY_OPTIONS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))}
                  darkMode={darkMode}
                />
              </div>

              {/* Toggles */}
              {([
                { key: 'pvp',         label: 'PvP' },
                { key: 'white-list',  label: 'Whitelist' },
                { key: 'online-mode', label: 'Modo online (autenticación)' },
              ] as { key: keyof ServerProperties; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{label}</span>
                  <button
                    role="switch"
                    aria-checked={props[key] === 'true'}
                    onClick={() => updateProp(key, props[key] === 'true' ? 'false' : 'true')}
                    className={toggleCls(props[key] === 'true')}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        props[key] === 'true' ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}

              {/* Seed */}
              <div className="sm:col-span-2">
                <label className={labelCls}>Semilla del mundo</label>
                <input
                  type="text"
                  value={props['level-seed'] ?? ''}
                  onChange={e => updateProp('level-seed', e.target.value)}
                  placeholder="Vacío = semilla aleatoria"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t gap-3 flex-wrap"
              style={{ borderColor: darkMode ? 'rgb(55 65 81 / 0.6)' : 'rgb(229 231 235)' }}
            >
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Los cambios requieren reiniciar el servidor para aplicarse.
              </p>
              <button
                onClick={saveProperties}
                disabled={savingProps}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-60 shadow-sm"
              >
                {savingProps
                  ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
                  : <Save size={13} aria-hidden="true" />
                }
                Guardar propiedades
              </button>
            </div>

            {propsMsg && (
              <p className={`text-xs mt-3 px-3 py-2 rounded-xl border ${propsMsg.type === 'ok'
                ? darkMode ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
                : darkMode ? 'bg-red-500/10 border-red-500/25 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {propsMsg.text}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
