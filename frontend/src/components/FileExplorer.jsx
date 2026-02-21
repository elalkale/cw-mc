import React, { useState, useEffect, useRef } from 'react';

const FileExplorer = ({ serverName }) => {
    // Vamos a guardar la lista de archivos aquí
    const [items, setItems] = useState([]);

    // Guardamos la ruta en la que estamos (por defecto la principal "/")
    const [currentPath, setCurrentPath] = useState('/');

    // Guardamos si hay algún error para mostrárselo al usuario
    const [error, setError] = useState(null);

    // Estado para saber si está cargando (para mostrar un spinner o texto)
    const [loading, setLoading] = useState(false);

    // === NUEVOS ESTADOS PARA LEER ARCHIVOS ===
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState('');
    const [loadingFile, setLoadingFile] = useState(false);

    // Esta función se encarga de ir al Backend a pedir los archivos
    const fetchFiles = async (path = '/') => {
        setLoadingFile(false);
        setLoading(true);
        setError(null);

        try {
            // Recuerda: sacamos de localStorage el token de las llaves ("tu-carnet-de-identidad")
            const token = localStorage.getItem('authToken');

            // Armamos la URL para llamar al backend. 
            // encodeURIComponent se asegura de que caracteres raros en la ruta no rompan el enlace
            const response = await fetch(`http://localhost:4000/api/files/${serverName}?path=${encodeURIComponent(path)}`, {
                headers: {
                    'Authorization': `Bearer ${token}` // Aquí le pasamos el token al guardia de seguridad
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al cargar los archivos');
            }

            setItems(data.items);
            setCurrentPath(data.currentPath);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // === NUEVA FUNCIÓN PARA ABRIR UN ARCHIVO ===
    const openFile = async (fileName) => {
        const filePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;

        setLoadingFile(true);
        setError(null);
        setSelectedFile(fileName);
        setFileContent(''); // Limpiamos contenido anterior

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`http://localhost:4000/api/files/${serverName}/content?path=${encodeURIComponent(filePath)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al leer el archivo');

            setFileContent(data.content);
        } catch (err) {
            setError(err.message);
            setSelectedFile(null); // Si hay error, cerramos el visor
        } finally {
            setLoadingFile(false);
        }
    };

    // Estado para guardar
    const [savingFile, setSavingFile] = useState(false);

    // === FUNCIÓN PARA GUARDAR EL ARCHIVO ===
    const saveFile = async () => {
        if (!selectedFile) return;

        const filePath = currentPath === '/' ? `/${selectedFile}` : `${currentPath}/${selectedFile}`;
        setSavingFile(true);
        setError(null);

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`http://localhost:4000/api/files/${serverName}/content?path=${encodeURIComponent(filePath)}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: fileContent })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al guardar el archivo');

            // Podríamos mostrar una notificación de éxito aquí
            // alert('Archivo guardado correctamente');
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingFile(false);
        }
    };

    // Estado para borrar
    const [deleting, setDeleting] = useState(false);

    // === FUNCIÓN PARA BORRAR UN ARCHIVO/CARPETA ===
    const deleteItem = async (itemName, e) => {
        // Evitamos que al dar click en borrar, también se abra la carpeta/archivo
        e.stopPropagation();

        const confirmDelete = window.confirm(`¿Estás seguro de que quieres eliminar "${itemName}"?\n¡Esta acción no se puede deshacer!`);
        if (!confirmDelete) return;

        const itemPath = currentPath === '/' ? `/${itemName}` : `${currentPath}/${itemName}`;
        setDeleting(true);
        setError(null);

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`http://localhost:4000/api/files/${serverName}/content?path=${encodeURIComponent(itemPath)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al eliminar');

            // Refrescar la lista de archivos actual tras borrar
            fetchFiles(currentPath);
        } catch (err) {
            setError(err.message);
        } finally {
            setDeleting(false);
        }
    };

    // === FUNCIONES PARA CREAR NUEVOS ARCHIVOS / CARPETAS ===
    const createNewItem = async (type) => {
        const promptText = type === 'folder' ? 'Nombre de la nueva carpeta:' : 'Nombre del nuevo archivo (ej. notas.txt):';
        const itemName = window.prompt(promptText);

        if (!itemName || itemName.trim() === '') return; // Cancelado o vacío
        if (itemName.includes('/') || itemName.includes('\\')) {
            return alert('El nombre no puede contener barras o caracteres especiales de directorios.');
        }

        setError(null);
        setLoading(true);

        try {
            const token = localStorage.getItem('authToken');
            const endpoint = type === 'folder'
                ? `http://localhost:4000/api/files/${serverName}/folder?path=${encodeURIComponent(currentPath)}`
                : `http://localhost:4000/api/files/${serverName}/file?path=${encodeURIComponent(currentPath)}`;

            const payloadKey = type === 'folder' ? 'folderName' : 'fileName';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ [payloadKey]: itemName.trim() })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Error al crear ${type}`);

            // Refrescar al finalizar con éxito
            fetchFiles(currentPath);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // === ESTADOS Y FUNCIÓN PARA SUBIDA DE ARCHIVOS ===
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`http://localhost:4000/api/files/${serverName}/upload?path=${encodeURIComponent(currentPath)}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // No especificar Content-Type aquí, fetch + FormData lo hace automáticamente
                },
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al subir archivo');

            // Refrescar lista de archivos al terminar
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchFiles(currentPath);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    // useEffect es un "gancho" de React que dice: 
    // "Ejecuta esta función (fetchFiles) nada más crear este componente"
    useEffect(() => {
        if (serverName) {
            fetchFiles('/');
        }
    }, [serverName]);

    // Si está cargando, mostramos esto
    if (loading) return <div className="text-gray-400">Cargando archivos...</div>;

    // Si hay error, mostramos esto
    if (error) return <div className="text-red-500">Error: {error}</div>;

    return (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 font-mono text-sm w-full h-full flex flex-col">
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
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        disabled={uploading}
                        className={`flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-green-300 px-2 py-1 rounded transition text-xs font-semibold ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Subir Archivo al Servidor"
                    >
                        {uploading ? '⏳ Subiendo...' : '📤 Subir'}
                    </button>
                </div>
            </div>
            {/* Botón para volver atrás (solo si no estamos en la raíz "/") */}
            {currentPath !== '/' && (
                <div
                    onClick={() => {
                        // Si estamos en /plugins/Essentials, queremos volver a /plugins
                        // Dividimos por "/" y quitamos el último elemento
                        const parts = currentPath.split('/').filter(Boolean);
                        parts.pop();
                        const newPath = '/' + parts.join('/');
                        fetchFiles(newPath);
                    }}
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors font-bold shrink-0"
                >
                    <span className="text-xl">🔙</span>
                    <span>.. (Volver)</span>
                </div>
            )}

            {/* Resolviendo el salto visual: El contenedor se expande para llenar todo el espacio restante (flex-1) */}
            <div className="space-y-1 overflow-y-auto flex-1 pe-2 custom-scrollbar">

                {items.length === 0 ? (
                    <div className="text-gray-500 italic p-2 h-full flex items-center justify-center">Carpeta vacía</div>
                ) : (
                    items.map((item) => (
                        <div
                            key={item.name}
                            // Si es carpeta, al hacer click llamamos a fetchFiles con la nueva ruta
                            onClick={() => {
                                if (item.isDirectory) {
                                    // Evitamos dobles barras como //plugins
                                    const newPath = currentPath === '/'
                                        ? `/${item.name}`
                                        : `${currentPath}/${item.name}`;
                                    fetchFiles(newPath);
                                } else {
                                    // === AHORA LLAMAMOS A LA FUNCIÓN DE LEER ===
                                    openFile(item.name);
                                }
                            }}
                            className="flex items-center gap-2 text-gray-300 hover:text-white p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                        >
                            <div className="flex items-center gap-2 flex-1 truncate">
                                <span className="text-xl shrink-0">
                                    {item.isDirectory ? '📁' : '📄'}
                                </span>
                                <span className="truncate">{item.name}</span>
                            </div>

                            {/* Botón de borrar (Papelera) */}
                            <button
                                onClick={(e) => deleteItem(item.name, e)}
                                disabled={deleting}
                                title={`Eliminar ${item.name}`}
                                className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition shrink-0"
                            >
                                🗑️
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* === EL MODAL/VISOR DEL ARCHIVO === */}
            {selectedFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700">
                        {/* Cabecera del visor */}
                        <div className="flex justify-between items-center p-4 border-b border-gray-700 shrink-0">
                            <h4 className="text-lg font-bold text-white truncate break-all">
                                📄 {selectedFile}
                            </h4>
                            <div className="flex gap-2">
                                <button
                                    onClick={saveFile}
                                    disabled={savingFile || loadingFile}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-sm transition font-bold disabled:opacity-50"
                                >
                                    {savingFile ? '⏳ Guardando...' : '💾 Guardar'}
                                </button>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition"
                                >
                                    ✖ Cerrar
                                </button>
                            </div>
                        </div>

                        {/* Contenido del archivo */}
                        <div className="p-4 flex-1 flex flex-col min-h-[50vh]">
                            {loadingFile ? (
                                <div className="text-gray-400 text-center py-10 flex-1 flex items-center justify-center">Cargando archivo...</div>
                            ) : (
                                <textarea
                                    className="flex-1 w-full bg-gray-950 text-gray-300 p-4 rounded text-xs sm:text-sm font-mono custom-scrollbar border border-gray-700 focus:border-purple-500 focus:outline-none resize-none"
                                    value={fileContent}
                                    onChange={(e) => setFileContent(e.target.value)}
                                    spellCheck="false"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileExplorer;
