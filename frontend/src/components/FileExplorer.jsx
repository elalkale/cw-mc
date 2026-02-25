import React, { useState, useEffect, useRef } from 'react';
import { API_BASE, fetchWithToken } from '../lib/api.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const IMAGE_EXT = /\.(png|jpg|jpeg|gif)$/i;
const BINARY_EXT = /\.(jar|java|zip|rar|7z|gz)$/i;

const isImage = (name) => IMAGE_EXT.test(name);

function getFileIcon(name, isDirectory) {
  if (isDirectory) return '📁';
  if (/\.(jar|java)$/.test(name)) return '📦';
  if (isImage(name)) return '🖼️';
  if (/\.(zip|rar|7z|gz)$/.test(name)) return '🗜️';
  if (/\.json$/.test(name)) return '📝';
  return '📄';
}

// Construye una ruta relativa correcta sin dobles barras
function joinPath(base, name) {
  return base === '/' ? `/${name}` : `${base}/${name}`;
}

// ── Componente ────────────────────────────────────────────────────────────────

const FileExplorer = ({ serverName }) => {
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

  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);

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

  // ── Guardar archivo (unificado para edición normal y reemplazo) ─────────────

  const saveFile = async (contentOverride, fileNameOverride) => {
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

  // ── Reemplazar archivo (desde input[file]) ──────────────────────────────────

  const handleReplaceFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm(`¿Reemplazar "${selectedFile}" con "${file.name}"?`)) {
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result;
      setFileContent(dataUrl);
      await saveFile(dataUrl, selectedFile);
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }

    e.target.value = null;
  };

  // ── Borrar ──────────────────────────────────────────────────────────────────

  const deleteItem = async (itemName, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar "${itemName}"?\n¡Esta acción no se puede deshacer!`)) return;

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

  const createNewItem = async (type) => {
    const label = type === 'folder' ? 'Nombre de la nueva carpeta:' : 'Nombre del nuevo archivo (ej. notas.txt):';
    const itemName = window.prompt(label);
    if (!itemName?.trim()) return;
    if (itemName.includes('/') || itemName.includes('\\')) {
      alert('El nombre no puede contener barras.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = type === 'folder'
        ? `${API_BASE}/api/files/${serverName}/folder?path=${encodeURIComponent(currentPath)}`
        : `${API_BASE}/api/files/${serverName}/file?path=${encodeURIComponent(currentPath)}`;
      const payloadKey = type === 'folder' ? 'folderName' : 'fileName';

      const res = await fetchWithToken(endpoint, {
        method: 'POST',
        body: JSON.stringify({ [payloadKey]: itemName.trim() }),
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

  if (loading) return <div className="text-gray-400">Cargando archivos...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 font-mono text-sm w-full h-full flex flex-col">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 shrink-0">
        <h3 className="text-lg font-bold text-white truncate break-all">
          Explorador: <span className="text-gray-400 break-all">{currentPath}</span>
        </h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => createNewItem('folder')}
            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-purple-300 px-2 py-1 rounded transition text-xs font-semibold"
            title="Crear Nueva Carpeta"
          >
            📁+ Carpeta
          </button>
          <button
            onClick={() => createNewItem('file')}
            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-blue-300 px-2 py-1 rounded transition text-xs font-semibold"
            title="Crear Nuevo Archivo"
          >
            📄+ Archivo
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-green-300 px-2 py-1 rounded transition text-xs font-semibold ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Subir Archivo al Servidor"
          >
            {uploading ? '⏳ Subiendo...' : '📤 Subir'}
          </button>
        </div>
      </div>

      {/* Botón volver */}
      {currentPath !== '/' && (
        <div
          onClick={() => {
            const parts = currentPath.split('/').filter(Boolean);
            parts.pop();
            fetchFiles('/' + parts.join('/'));
          }}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors font-bold shrink-0"
        >
          <span className="text-xl">🔙</span>
          <span>.. (Volver)</span>
        </div>
      )}

      {/* Listado */}
      <div className="space-y-1 overflow-y-auto flex-1 pe-2 custom-scrollbar">
        {items.length === 0 ? (
          <div className="text-gray-500 italic p-2 h-full flex items-center justify-center">Carpeta vacía</div>
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
              className="flex items-center gap-2 text-gray-300 hover:text-white p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 truncate">
                <span className="text-xl shrink-0">{getFileIcon(item.name, item.isDirectory)}</span>
                <span className="truncate">{item.name}</span>
              </div>

              <button
                onClick={(e) => deleteItem(item.name, e)}
                disabled={deleting}
                title={`Eliminar ${item.name}`}
                className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition shrink-0"
              >
                🗑️
              </button>

              {!item.isDirectory && (
                <button
                  onClick={(e) => handleDownload(item.name, e)}
                  disabled={downloading}
                  title={`Descargar ${item.name}`}
                  className="text-gray-500 hover:text-green-500 hover:bg-green-500/10 p-1.5 rounded transition shrink-0"
                >
                  ⬇️
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Visor / editor de archivo */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700">
            {/* Cabecera del visor */}
            <div className="flex justify-between items-center p-4 border-b border-gray-700 shrink-0">
              <h4 className="text-lg font-bold text-white truncate break-all">
                {getFileIcon(selectedFile, false)} {selectedFile}
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => replaceInputRef.current?.click()}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                >
                  Reemplazar
                </button>
                <input
                  type="file"
                  ref={replaceInputRef}
                  className="hidden"
                  onChange={handleReplaceFile}
                />
                {!isImage(selectedFile) && (
                  <button
                    onClick={() => saveFile()}
                    disabled={savingFile || loadingFile}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-sm transition font-bold disabled:opacity-50"
                  >
                    {savingFile ? '⏳ Guardando...' : '💾 Guardar'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedFile(null)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition"
                >
                  ✖ Cerrar
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col min-h-[50vh]">
              {isImage(selectedFile) ? (
                <img
                  className="max-w-full max-h-[50vh] object-contain mx-auto my-4"
                  src={fileContent}
                  alt={selectedFile}
                />
              ) : (
                <div className="flex-1 flex flex-col min-h-[50vh]">
                  {loadingFile ? (
                    <div className="text-gray-400 text-center py-10 flex-1 flex items-center justify-center">
                      Cargando archivo...
                    </div>
                  ) : (
                    <textarea
                      className="flex-1 w-full bg-gray-950 text-gray-300 p-4 rounded text-xs sm:text-sm font-mono custom-scrollbar border border-gray-700 focus:border-purple-500 focus:outline-none resize-none"
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
