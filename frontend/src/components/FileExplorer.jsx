import React, { useState, useEffect } from 'react';

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
            <h3 className="text-lg font-bold text-white mb-4 shrink-0 truncate">
                Explorador: <span className="text-gray-400 break-all">{currentPath}</span>
            </h3>
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
                            <span className="text-xl">
                                {item.isDirectory ? '📁' : '📄'}
                            </span>
                            <span className="truncate">{item.name}</span>
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
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="text-gray-400 hover:text-red-400 transition"
                            >
                                ✖ Cerrar
                            </button>
                        </div>

                        {/* Contenido del archivo */}
                        <div className="p-4 overflow-y-auto flex-1">
                            {loadingFile ? (
                                <div className="text-gray-400 text-center py-10">Cargando archivo...</div>
                            ) : (
                                <pre className="text-gray-300 bg-gray-950 p-4 rounded text-xs sm:text-sm overflow-x-auto whitespace-pre-wrap word-break">
                                    {fileContent === '' ? <span className="text-gray-500 italic">Archivo vacío</span> : fileContent}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileExplorer;
