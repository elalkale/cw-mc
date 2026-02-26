import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus, FilePlus, Upload, ArrowLeft, Trash2,
  Download, Save, X, RefreshCw, Folder, File,
  FileCode, FileImage, Archive, Package
} from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

const IMAGE_EXT = /\.(png|jpg|jpeg|gif)$/i;
const BINARY_EXT = /\.(jar|java|zip|rar|7z|gz)$/i;

const isImage = (name) => IMAGE_EXT.test(name);

function FileIcon({ name, isDirectory, size = 16 }) {
  if (isDirectory) return <Folder size={size} className="text-yellow-500 shrink-0" />;
  if (/\.(jar|java)$/.test(name)) return <Package size={size} className="text-orange-400 shrink-0" />;
  if (isImage(name)) return <FileImage size={size} className="text-blue-400 shrink-0" />;
  if (/\.(zip|rar|7z|gz)$/.test(name)) return <Archive size={size} className="text-purple-400 shrink-0" />;
  if (/\.(json|yaml|yml|toml|cfg|conf|properties|txt|log|md)$/.test(name)) return <FileCode size={size} className="text-green-500 shrink-0" />;
  return <File size={size} className="text-gray-400 shrink-0" />;
}

function joinPath(base, name) {
  return base === '/' ? `/${name}` : `${base}/${name}`;
}

// ── Componente ────────────────────────────────────────────────────────────────

const FileExplorer = ({ serverName, darkMode }) => {
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [savingFile, setSavingFile] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [deleteConfirm, setDeleteConfirm]   = useState(null); // { name }
  const [replaceConfirm, setReplaceConfirm] = useState(null); // { oldName, newName, file }
  const [createPrompt, setCreatePrompt]     = useState(null); // { type, value, error }

  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  // ── Tokens de color según modo ─────────────────────────────────────────────

  const bg       = darkMode ? 'bg-gray-900'       : 'bg-white';
  const border   = darkMode ? 'border-gray-700/60' : 'border-gray-200';
  const headerBg = darkMode ? 'bg-gray-800/50'     : 'bg-gray-50';
  const pathText = darkMode ? 'text-gray-400'      : 'text-gray-500';
  const rowHover = darkMode ? 'hover:bg-gray-800'  : 'hover:bg-gray-100';
  const rowText  = darkMode ? 'text-gray-300'      : 'text-gray-700';
  const rowTextHover = darkMode ? 'group-hover:text-white' : 'group-hover:text-gray-900';
  const emptyText = darkMode ? 'text-gray-600'     : 'text-gray-400';
  const backBorder = darkMode ? 'border-gray-700/40' : 'border-gray-200';
  const backText   = darkMode ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-800' : 'text-blue-600 hover:text-blue-800 hover:bg-gray-100';

  // Toolbar buttons
  const btnBase = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition text-xs font-sans font-medium border';
  const btnFolder = darkMode
    ? `${btnBase} bg-gray-700/60 hover:bg-gray-700 text-purple-300 hover:text-purple-200 border-gray-600/40 hover:border-purple-500/30`
    : `${btnBase} bg-white hover:bg-purple-50 text-purple-700 border-gray-200 hover:border-purple-400/50`;
  const btnFile = darkMode
    ? `${btnBase} bg-gray-700/60 hover:bg-gray-700 text-blue-300 hover:text-blue-200 border-gray-600/40 hover:border-blue-500/30`
    : `${btnBase} bg-white hover:bg-blue-50 text-blue-700 border-gray-200 hover:border-blue-400/50`;
  const btnUpload = darkMode
    ? `${btnBase} bg-gray-700/60 hover:bg-gray-700 text-green-300 hover:text-green-200 border-gray-600/40 hover:border-green-500/30`
    : `${btnBase} bg-white hover:bg-green-50 text-green-700 border-gray-200 hover:border-green-400/50`;
  const btnRefresh = darkMode
    ? `flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-gray-400 hover:text-gray-300 transition border border-gray-600/40`
    : `flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition border border-gray-200`;

  // Editor modal
  const modalBg     = darkMode ? 'bg-gray-900 border-gray-700/60' : 'bg-white border-gray-200';
  const modalHeader = darkMode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-gray-50 border-gray-200';
  const modalTitle  = darkMode ? 'text-white' : 'text-gray-900';
  const textareaBg  = darkMode
    ? 'bg-gray-950 text-gray-300 border-gray-700/60 focus:border-purple-500/60'
    : 'bg-gray-50 text-gray-800 border-gray-300 focus:border-purple-400';

  // ── Cargar listado ──────────────────────────────────────────────────────────

  const fetchFiles = async (targetPath = '/') => {
    setLoading(true);
    setError(null);
    setLoadingFile(false);

    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/files/${serverName}?path=${encodeURIComponent(targetPath)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar los archivos');
      setItems(data.items);
      setCurrentPath(data.currentPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverName) fetchFiles('/');
  }, [serverName]);

  // ── Abrir archivo ───────────────────────────────────────────────────────────

  const openFile = async (fileName) => {
    const filePath = joinPath(currentPath, fileName);
    setLoadingFile(true);
    setError(null);
    setSelectedFile(fileName);
    setFileContent(null);

    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/files/${serverName}/content?path=${encodeURIComponent(filePath)}`
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Error al leer el archivo');
      }

      if (isImage(fileName)) {
        const blob = await res.blob();
        setFileContent(URL.createObjectURL(blob));
      } else {
        const data = await res.json();
        setFileContent(data.content);
      }
    } catch (err) {
      setError(err.message);
      setSelectedFile(null);
    } finally {
      setLoadingFile(false);
    }
  };

  // ── Guardar archivo ─────────────────────────────────────────────────────────

  const saveFile = async (contentOverride = undefined, fileNameOverride = undefined) => {
    const targetName = fileNameOverride ?? selectedFile;
    const targetContent = contentOverride ?? fileContent;
    if (!targetName) return;

    setSavingFile(true);
    setError(null);

    try {
      const filePath = joinPath(currentPath, targetName);
      let body;

      if (isImage(targetName)) {
        if (typeof targetContent === 'string' && targetContent.startsWith('blob:')) {
          const res = await fetch(targetContent);
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          body = { content: dataUrl, isBase64: true };
        } else {
          body = { content: targetContent, isBase64: true };
        }
      } else {
        body = { content: targetContent };
      }

      const res = await fetchWithToken(
        `${API_BASE}/api/files/${serverName}/content?path=${encodeURIComponent(filePath)}`,
        { method: 'PUT', body: JSON.stringify(body) }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el archivo');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingFile(false);
    }
  };

  // ── Reemplazar archivo ──────────────────────────────────────────────────────

  const handleReplaceFile = (e) => {
    const file = e.target.files[0];
    e.target.value = null;
    if (!file) return;
    setReplaceConfirm({ oldName: selectedFile, newName: file.name, file });
  };

  const confirmReplace = () => {
    const { file } = replaceConfirm;
    setReplaceConfirm(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      setFileContent(dataUrl);
      await saveFile(dataUrl, selectedFile);
    };
    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  // ── Borrar ──────────────────────────────────────────────────────────────────

  const deleteItem = (itemName, e) => {
    e.stopPropagation();
    setDeleteConfirm({ name: itemName });
  };

  const confirmDelete = async () => {
    const itemName = deleteConfirm.name;
    setDeleteConfirm(null);
    const itemPath = joinPath(currentPath, itemName);
    setDeleting(true);
    setError(null);
    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/files/${serverName}/content?path=${encodeURIComponent(itemPath)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      fetchFiles(currentPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Crear carpeta / archivo ─────────────────────────────────────────────────

  const createNewItem = (type) => {
    setCreatePrompt({ type, value: '', error: '' });
  };

  const confirmCreate = async () => {
    const { type, value } = createPrompt;
    const itemName = value.trim();
    if (!itemName) { setCreatePrompt(p => ({ ...p, error: 'El nombre no puede estar vacío.' })); return; }
    if (itemName.includes('/') || itemName.includes('\\')) { setCreatePrompt(p => ({ ...p, error: 'El nombre no puede contener barras.' })); return; }
    setCreatePrompt(null);
    setLoading(true);
    setError(null);
    try {
      const endpoint = type === 'folder'
        ? `${API_BASE}/api/files/${serverName}/folder?path=${encodeURIComponent(currentPath)}`
        : `${API_BASE}/api/files/${serverName}/file?path=${encodeURIComponent(currentPath)}`;
      const payloadKey = type === 'folder' ? 'folderName' : 'fileName';
      const res = await fetchWithToken(endpoint, {
        method: 'POST',
        body: JSON.stringify({ [payloadKey]: itemName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error al crear ${type}`);
      fetchFiles(currentPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Subir archivo ───────────────────────────────────────────────────────────

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetchWithToken(
        `${API_BASE}/api/files/${serverName}/upload?path=${encodeURIComponent(currentPath)}`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir archivo');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFiles(currentPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Descargar archivo ───────────────────────────────────────────────────────

  const handleDownload = async (fileName, e) => {
    e?.stopPropagation();
    setDownloading(true);
    setError(null);

    try {
      const filePath = joinPath(currentPath, fileName);
      const res = await fetchWithToken(
        `${API_BASE}/api/files/${serverName}/download?path=${encodeURIComponent(filePath)}`
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al descargar archivo');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`${bg} rounded-2xl border ${border} font-mono text-sm w-full h-full flex flex-col overflow-hidden shadow-lg transition-colors`}>

      {/* Cabecera */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-4 py-3 border-b ${border} ${headerBg} shrink-0`}>
        <div className="flex items-center gap-2 min-w-0">
          <Folder size={15} className="text-purple-400 shrink-0" />
          <span className={`text-xs ${pathText} font-sans font-medium truncate`}>
            {currentPath}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => createNewItem('folder')} title="Nueva carpeta" className={btnFolder}>
            <FolderPlus size={13} />
            Carpeta
          </button>
          <button onClick={() => createNewItem('file')} title="Nuevo archivo" className={btnFile}>
            <FilePlus size={13} />
            Archivo
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Subir archivo"
            className={`${btnUpload} ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploading
              ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-current animate-spin" />
              : <Upload size={13} />}
            {uploading ? 'Subiendo...' : 'Subir'}
          </button>
          <button onClick={() => fetchFiles(currentPath)} title="Recargar" className={btnRefresh}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-sans shrink-0">
          {error}
        </div>
      )}

      {/* Botón volver */}
      {currentPath !== '/' && (
        <button
          onClick={() => {
            const parts = currentPath.split('/').filter(Boolean);
            parts.pop();
            fetchFiles('/' + parts.join('/'));
          }}
          className={`flex items-center gap-2 px-4 py-2 transition-colors font-sans text-xs font-medium shrink-0 border-b ${backBorder} ${backText}`}
        >
          <ArrowLeft size={13} />
          <span className={pathText}>..</span>
          <span>Volver</span>
        </button>
      )}

      {/* Listado */}
      <div className="space-y-px overflow-y-auto flex-1 p-2 custom-scrollbar">
        {loading ? (
          <div className={`flex items-center justify-center gap-2 ${emptyText} font-sans text-xs py-8`}>
            <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-purple-500 animate-spin" />
            Cargando...
          </div>
        ) : items.length === 0 ? (
          <div className={`${emptyText} italic font-sans text-xs text-center py-8`}>Carpeta vacía</div>
        ) : (
          items.map((item) => (
            <div
              key={item.name}
              onClick={() => {
                if (item.isDirectory) {
                  fetchFiles(joinPath(currentPath, item.name));
                } else if (!BINARY_EXT.test(item.name)) {
                  openFile(item.name);
                }
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors group ${
                item.isDirectory || !BINARY_EXT.test(item.name)
                  ? `${rowHover} cursor-pointer`
                  : 'cursor-default opacity-60'
              }`}
            >
              <FileIcon name={item.name} isDirectory={item.isDirectory} size={15} />
              <span className={`flex-1 truncate ${rowText} ${rowTextHover} text-xs`}>
                {item.name}
              </span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!item.isDirectory && (
                  <button
                    onClick={(e) => handleDownload(item.name, e)}
                    disabled={downloading}
                    title={`Descargar ${item.name}`}
                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                  >
                    <Download size={13} />
                  </button>
                )}
                <button
                  onClick={(e) => deleteItem(item.name, e)}
                  disabled={deleting}
                  title={`Eliminar ${item.name}`}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Modal: Eliminar archivo/carpeta ──────────────────────────────────── */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => !deleting && setDeleteConfirm(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4 font-sans">
            <div className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-red-500/30' : 'bg-white border-red-200/70'}`} onClick={e => e.stopPropagation()}>
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-red-500/15' : 'bg-red-100'}`}>
                    <Trash2 size={14} className="text-red-400" />
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Eliminar</h3>
                </div>
                <button onClick={() => !deleting && setDeleteConfirm(null)} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><X size={15} /></button>
              </div>
              <div className="px-5 py-4">
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>¿Eliminar <span className="font-semibold text-red-400 font-mono">{deleteConfirm.name}</span>?</p>
                <p className={`text-xs mt-1.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Esta acción no se puede deshacer.</p>
              </div>
              <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} disabled:opacity-50`}>Cancelar</button>
                <button onClick={confirmDelete} disabled={deleting} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-60">
                  {deleting ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />Eliminando...</> : <><Trash2 size={14} />Eliminar</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: Reemplazar archivo ─────────────────────────────────────────── */}
      {replaceConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setReplaceConfirm(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4 font-sans">
            <div className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/30' : 'bg-white border-purple-200/70'}`} onClick={e => e.stopPropagation()}>
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
                    <RefreshCw size={14} className="text-purple-400" />
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Reemplazar archivo</h3>
                </div>
                <button onClick={() => setReplaceConfirm(null)} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><X size={15} /></button>
              </div>
              <div className="px-5 py-4">
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>¿Reemplazar <span className="font-semibold text-purple-400 font-mono">{replaceConfirm.oldName}</span></p>
                <p className={`text-sm mt-0.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>con <span className="font-semibold font-mono">{replaceConfirm.newName}</span>?</p>
              </div>
              <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button onClick={() => setReplaceConfirm(null)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Cancelar</button>
                <button onClick={confirmReplace} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors">
                  <RefreshCw size={14} />Reemplazar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: Crear carpeta / archivo ────────────────────────────────────── */}
      {createPrompt && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setCreatePrompt(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4 font-sans">
            <div className={`w-full max-w-sm rounded-2xl shadow-2xl border pointer-events-auto ${darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-purple-500/25' : 'bg-white border-purple-200/70'}`} onClick={e => e.stopPropagation()}>
              <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-purple-500/15' : 'bg-purple-100'}`}>
                    {createPrompt.type === 'folder' ? <FolderPlus size={14} className="text-purple-400" /> : <FilePlus size={14} className="text-purple-400" />}
                  </div>
                  <h3 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{createPrompt.type === 'folder' ? 'Nueva carpeta' : 'Nuevo archivo'}</h3>
                </div>
                <button onClick={() => setCreatePrompt(null)} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><X size={15} /></button>
              </div>
              <div className="px-5 py-4">
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{createPrompt.type === 'folder' ? 'Nombre de la carpeta' : 'Nombre del archivo'}</label>
                <input
                  autoFocus
                  type="text"
                  value={createPrompt.value}
                  onChange={e => setCreatePrompt(p => ({ ...p, value: e.target.value, error: '' }))}
                  onKeyDown={e => e.key === 'Enter' && confirmCreate()}
                  placeholder={createPrompt.type === 'folder' ? 'mi-carpeta' : 'archivo.txt'}
                  className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none transition-colors ${darkMode ? 'bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500/60' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-purple-400'}`}
                />
                {createPrompt.error && <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{createPrompt.error}</p>}
              </div>
              <div className={`flex justify-end gap-2 px-5 py-4 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200'}`}>
                <button onClick={() => setCreatePrompt(null)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Cancelar</button>
                <button onClick={confirmCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors">
                  {createPrompt.type === 'folder' ? <FolderPlus size={14} /> : <FilePlus size={14} />}Crear
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Visor / editor de archivo */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`${modalBg} rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border`}>

            {/* Cabecera del visor */}
            <div className={`flex justify-between items-center px-5 py-3.5 border-b ${modalHeader} rounded-t-2xl shrink-0`}>
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon name={selectedFile} isDirectory={false} size={15} />
                <span className={`text-sm font-semibold ${modalTitle} font-sans truncate`}>{selectedFile}</span>
              </div>

              <div className="flex items-center gap-2">
                <input type="file" ref={replaceInputRef} className="hidden" onChange={handleReplaceFile} />
                <button
                  onClick={() => replaceInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 text-xs font-sans font-medium transition"
                >
                  <RefreshCw size={12} />
                  Reemplazar
                </button>

                {!isImage(selectedFile) && (
                  <button
                    onClick={() => saveFile()}
                    disabled={savingFile || loadingFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 text-xs font-sans font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingFile
                      ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-current animate-spin" />
                      : <Save size={12} />}
                    {savingFile ? 'Guardando...' : 'Guardar'}
                  </button>
                )}

                <button
                  onClick={() => setSelectedFile(null)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition border ${
                    darkMode
                      ? 'bg-gray-700/60 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border-gray-600/40'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 border-gray-300'
                  }`}
                >
                  <X size={12} />
                  Cerrar
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col min-h-[50vh]">
              {isImage(selectedFile) ? (
                <img
                  className="max-w-full max-h-[50vh] object-contain mx-auto my-4 rounded-lg"
                  src={fileContent}
                  alt={selectedFile}
                />
              ) : (
                <div className="flex-1 flex flex-col min-h-[50vh]">
                  {loadingFile ? (
                    <div className={`${emptyText} text-center py-10 flex-1 flex items-center justify-center gap-2 text-sm font-sans`}>
                      <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-purple-500 animate-spin" />
                      Cargando archivo...
                    </div>
                  ) : (
                    <textarea
                      className={`flex-1 w-full p-4 rounded-xl text-xs sm:text-sm font-mono custom-scrollbar border focus:outline-none resize-none transition-colors ${textareaBg}`}
                      value={fileContent ?? ''}
                      onChange={(e) => setFileContent(e.target.value)}
                      spellCheck="false"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
