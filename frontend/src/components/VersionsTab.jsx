import React from 'react';
import { Download, Server, ChevronLeft, ChevronRight } from 'lucide-react';

export default function VersionsTab({
  files, loadingFiles, filesPage, setFilesPage, filesTotalCount,
  downloadingFile, onDownloadFile,
  installStatus, onInstallFile,
  darkMode,
}) {
  const totalFilePages = Math.ceil(filesTotalCount / 50);
  const serverFiles = files.filter(f => f.serverPackFileId || f.isServerPack);

  return (
    <>
      {filesTotalCount > 0 && (
        <p className={`text-xs mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          <span className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{filesTotalCount.toLocaleString()}</span> archivos · página {filesPage + 1} de {totalFilePages}
        </p>
      )}

      {loadingFiles ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`h-10 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-200'}`} />
          ))}
        </div>
      ) : serverFiles.length === 0 ? (
        <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>No hay server packs disponibles en esta página.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs uppercase tracking-widest border-b ${darkMode ? 'text-gray-500 border-gray-700/60' : 'text-gray-400 border-gray-200'}`}>
                <th className="pb-3 text-left font-semibold">Nombre</th>
                <th className="pb-3 text-left font-semibold">Versión MC</th>
                <th className="pb-3 text-left font-semibold">Fecha</th>
                <th className="pb-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-gray-700/40' : 'divide-gray-200'}`}>
              {serverFiles.map(file => (
                <tr key={file.id} className={`transition-colors ${darkMode ? 'hover:bg-purple-500/5' : 'hover:bg-purple-50/60'}`}>
                  <td className="py-3 pr-4">
                    <span className={`line-clamp-1 text-xs font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      {file.displayName || file.fileName}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {(file.gameVersions ?? []).filter(v => /^\d+\.\d+/.test(v)).slice(0, 3).map(v => (
                        <span key={v} className={`px-1.5 py-0.5 rounded-lg text-xs border font-mono ${darkMode ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-200/80'}`}>
                          {v}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`py-3 pr-4 whitespace-nowrap text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {new Date(file.fileDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex gap-1.5 justify-end">
                      <button
                        onClick={() => onDownloadFile(file.serverPackFileId ?? file.id)}
                        disabled={downloadingFile === (file.serverPackFileId ?? file.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm"
                        aria-label={`Descargar ${file.displayName}`}
                      >
                        {downloadingFile === (file.serverPackFileId ?? file.id)
                          ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin" />
                          : <Download size={11} aria-hidden="true" />
                        }
                        Descargar
                      </button>
                      <button
                        onClick={() => onInstallFile(file.serverPackFileId ?? file.id, file.displayName || file.fileName)}
                        disabled={installStatus === 'installing'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${darkMode
                          ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50'
                          : 'border-purple-400/60 text-purple-700 hover:bg-purple-50'
                        }`}
                        aria-label={`Instalar ${file.displayName}`}
                      >
                        <Server size={11} aria-hidden="true" />
                        Instalar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filesTotalCount > 50 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={() => setFilesPage(p => Math.max(0, p - 1))}
            disabled={filesPage === 0}
            className={`p-2 rounded-xl border transition-all ${filesPage === 0
              ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-transparent shadow-md hover:scale-[1.05] active:scale-95'
            }`}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className={`text-sm tabular-nums px-3 py-1.5 rounded-xl border ${darkMode ? 'bg-gray-800/60 border-gray-700/60 text-gray-400' : 'bg-white border-gray-200 text-gray-500 shadow-sm'}`}>
            {filesPage + 1} / {totalFilePages}
          </span>
          <button
            onClick={() => setFilesPage(p => Math.min(totalFilePages - 1, p + 1))}
            disabled={filesPage >= totalFilePages - 1}
            className={`p-2 rounded-xl border transition-all ${filesPage >= totalFilePages - 1
              ? `opacity-40 cursor-not-allowed ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-transparent shadow-md hover:scale-[1.05] active:scale-95'
            }`}
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
