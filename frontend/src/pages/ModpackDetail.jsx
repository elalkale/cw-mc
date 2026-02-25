import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { API_BASE, fetchWithToken } from '../lib/api.js';
import modpacksData from '../resources/modpacks_with_server.json';

import StatBadge      from '../components/StatBadge.jsx';
import ModpackHero    from '../components/ModpackHero.jsx';
import ModpackTabs    from '../components/ModpackTabs.jsx';
import DescriptionHTML from '../components/DescriptionHTML.jsx';
import ScreenshotsTab from '../components/ScreenshotsTab.jsx';
import VersionsTab    from '../components/VersionsTab.jsx';
import InstallModal   from '../components/InstallModal.jsx';
import Lightbox       from '../components/Lightbox.jsx';

export default function ModpackDetail({ darkMode, onInstallStart, onInstallClear, installations = {} }) {
  const { modId } = useParams();
  const navigate  = useNavigate();

  const localPack = modpacksData.find(m => m.modId === Number(modId));

  const [cfMod, setCfMod] = useState(null);

  const livePack = useMemo(() => {
    if (!cfMod || !localPack) return localPack;
    const liveLoaders = cfMod.latestFilesIndexes?.length
      ? [...new Set(cfMod.latestFilesIndexes.map(f => f.modLoader).filter(Boolean))]
      : null;
    const liveVersions = cfMod.latestFilesIndexes?.length
      ? [...new Set(cfMod.latestFilesIndexes.map(f => f.gameVersion).filter(Boolean))]
      : null;
    return {
      ...localPack,
      downloadCount:       cfMod.downloadCount       ?? localPack.downloadCount,
      gamePopularityRank:  cfMod.gamePopularityRank  ?? localPack.gamePopularityRank,
      dateModified:        cfMod.dateModified         ?? localPack.dateModified,
      dateReleased:        cfMod.dateReleased         ?? localPack.dateReleased,
      ...(liveLoaders  && { modLoaders:   liveLoaders  }),
      ...(liveVersions && { gameVersions: liveVersions }),
    };
  }, [cfMod, localPack]);

  const [description,  setDescription]  = useState('');
  const [loadingMod,   setLoadingMod]   = useState(true);
  const [loadingDesc,  setLoadingDesc]  = useState(true);

  const [downloading,   setDownloading]   = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const [files,           setFiles]           = useState([]);
  const [loadingFiles,    setLoadingFiles]    = useState(true);
  const [filesPage,       setFilesPage]       = useState(0);
  const [filesTotalCount, setFilesTotalCount] = useState(0);
  const [downloadingFile, setDownloadingFile] = useState(null);

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [serverNameInput,  setServerNameInput]  = useState('');
  const [installFileId,    setInstallFileId]    = useState(null);
  const [installFileLabel, setInstallFileLabel] = useState('');

  const currentInstall = Object.entries(installations).find(([, info]) => info.modId === localPack?.modId);
  const installStatus  = currentInstall?.[1]?.status ?? 'idle';
  const installError   = currentInstall?.[1]?.error  ?? '';

  const currentInstallRef = useRef(null);
  useEffect(() => { currentInstallRef.current = currentInstall; }, [currentInstall]);
  useEffect(() => {
    return () => {
      const install = currentInstallRef.current;
      if (install?.[1]?.status === 'done') onInstallClear?.(install[0]);
    };
  }, []);

  const [tab,      setTab]      = useState('descripcion');
  const [lightbox, setLightbox] = useState(null);

  // ── Fetch mod + description ───────────────────────────────────────────────

  useEffect(() => {
    if (!modId) return;
    setLoadingMod(true);
    setLoadingDesc(true);
    setCfMod(null);
    setDescription('');

    fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}`)
      .then(r => r.json())
      .then(data => { if (data?.data) setCfMod(data.data); })
      .catch(console.error)
      .finally(() => setLoadingMod(false));

    fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/description`)
      .then(r => r.json())
      .then(data => { if (data?.data) setDescription(data.data); })
      .catch(console.error)
      .finally(() => setLoadingDesc(false));
  }, [modId]);

  // ── Fetch files ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!modId) return;
    setLoadingFiles(true);
    setFiles([]);
    fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/files?index=${filesPage * 50}&pageSize=50`)
      .then(r => r.json())
      .then(data => {
        if (data?.data) setFiles(data.data);
        if (data?.pagination?.totalCount != null) setFilesTotalCount(data.pagination.totalCount);
      })
      .catch(console.error)
      .finally(() => setLoadingFiles(false));
  }, [modId, filesPage]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openInstallModal = (fileId, fileLabel, defaultName) => {
    setInstallFileId(fileId);
    setInstallFileLabel(fileLabel);
    setServerNameInput(defaultName);
    setShowInstallModal(true);
  };

  const startInstall = async () => {
    const name = serverNameInput.trim();
    if (!name) return;
    const fileId = installFileId ?? localPack.serverFileId;
    setShowInstallModal(false);
    try {
      const res  = await fetchWithToken(`${API_BASE}/api/install`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ modId: localPack.modId, fileId, serverName: name }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onInstallStart?.(data.installId, {
        modId:      localPack.modId,
        serverName: name,
        modName:    localPack.name,
        logo:       cfMod?.logo?.thumbnailUrl ?? null,
      });
    } catch (err) {
      onInstallStart?.(`err-${Date.now()}`, {
        modId:      localPack.modId,
        serverName: name,
        modName:    localPack.name,
        logo:       cfMod?.logo?.thumbnailUrl ?? null,
        status:     'error',
        error:      err.message,
      });
    }
  };

  const downloadFile = async (fileId) => {
    setDownloadingFile(fileId);
    try {
      const res  = await fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/file/${fileId}/download-url`);
      const data = await res.json();
      const url  = data?.data;
      if (!url) throw new Error('URL no disponible');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // silencioso
    } finally {
      setDownloadingFile(null);
    }
  };

  const downloadServerPack = async () => {
    if (!localPack?.serverFileId) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const res  = await fetchWithToken(`${API_BASE}/api/curseforge/mod/${modId}/file/${localPack.serverFileId}/download-url`);
      const data = await res.json();
      const url  = data?.data;
      if (!url) throw new Error('No se pudo obtener la URL de descarga');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  // ── Estilos ───────────────────────────────────────────────────────────────

  const bg = darkMode
    ? "bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]"
    : "bg-[radial-gradient(ellipse_at_top,_#ede9fe_0%,_#f9f9ff_55%,_#faf5ff_100%)]";

  const cardClass = darkMode
    ? 'bg-gradient-to-br from-gray-800/90 via-purple-950/10 to-gray-900 border-purple-500/30'
    : 'bg-gradient-to-br from-white to-purple-50/70 border-purple-300/60 shadow-sm';

  // ── Not found ─────────────────────────────────────────────────────────────

  if (!localPack) {
    return (
      <div className={`min-h-screen relative ${bg}`}>
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-8">
          <button
            onClick={() => navigate('/catalog')}
            className={`flex items-center gap-2 text-sm mb-6 px-3.5 py-2 rounded-xl border transition-all hover:scale-[1.02] ${darkMode
              ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10'
              : 'border-purple-400/60 text-purple-700 hover:bg-purple-50'
            }`}
          >
            <ArrowLeft size={15} /> Volver al catálogo
          </button>
          <div role="alert" className={`px-4 py-3 rounded-xl border text-sm ${darkMode
            ? 'bg-red-500/10 border-red-500/25 text-red-300'
            : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            Modpack no encontrado.
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen relative transition-colors duration-300 ${bg}`}>

      {/* Blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-15 ${darkMode ? "bg-purple-600" : "bg-purple-400"}`} />
        <div className={`absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 ${darkMode ? "bg-pink-600" : "bg-pink-400"}`} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-8 pb-16">

        {/* Back button */}
        <button
          onClick={() => navigate('/catalog')}
          className={`flex items-center gap-2 text-sm mb-6 px-3.5 py-2 rounded-xl border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
            ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50'
            : 'border-purple-400/60 text-purple-700 hover:bg-purple-50 hover:border-purple-500/70'
          }`}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Volver al catálogo
        </button>

        {/* Hero */}
        <ModpackHero
          cfMod={cfMod}
          livePack={livePack}
          localPack={localPack}
          loadingMod={loadingMod}
          darkMode={darkMode}
          cardClass={cardClass}
          downloading={downloading}
          onDownloadServerPack={downloadServerPack}
          downloadError={downloadError}
          installStatus={installStatus}
          installError={installError}
          files={files}
          onOpenInstallModal={openInstallModal}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatBadge label="Descargas"   value={livePack.downloadCount.toLocaleString()} darkMode={darkMode} />
          <StatBadge label="Publicado"   value={new Date(livePack.dateReleased).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} darkMode={darkMode} />
          <StatBadge label="Actualizado" value={new Date(livePack.dateModified).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} darkMode={darkMode} />
          <StatBadge label="Popularidad" value={`#${livePack.gamePopularityRank.toLocaleString()}`} darkMode={darkMode} />
        </div>

        {/* Tabs */}
        <ModpackTabs
          tab={tab}
          onTabChange={setTab}
          cfMod={cfMod}
          filesTotalCount={filesTotalCount}
          darkMode={darkMode}
        />

        {/* Tab content */}
        <section className={`rounded-2xl border p-5 sm:p-6 ${cardClass}`}>

          {tab === 'descripcion' && (
            loadingDesc ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`h-3.5 rounded-lg animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-200'}`} style={{ width: `${92 - i * 8}%` }} />
                ))}
              </div>
            ) : description ? (
              <DescriptionHTML html={description} darkMode={darkMode} />
            ) : (
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Sin descripción disponible.</p>
            )
          )}

          {tab === 'screenshots' && (
            <ScreenshotsTab
              screenshots={cfMod?.screenshots}
              onOpenLightbox={setLightbox}
              darkMode={darkMode}
            />
          )}

          {tab === 'versiones' && (
            <VersionsTab
              files={files}
              loadingFiles={loadingFiles}
              filesPage={filesPage}
              setFilesPage={setFilesPage}
              filesTotalCount={filesTotalCount}
              downloadingFile={downloadingFile}
              onDownloadFile={downloadFile}
              installStatus={installStatus}
              onInstallFile={(fileId, fileLabel) => openInstallModal(fileId, fileLabel, localPack.slug)}
              darkMode={darkMode}
            />
          )}

        </section>
      </div>

      <InstallModal
        show={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        installFileLabel={installFileLabel}
        serverNameInput={serverNameInput}
        setServerNameInput={setServerNameInput}
        onInstall={startInstall}
        darkMode={darkMode}
      />

      <Lightbox
        src={lightbox}
        onClose={() => setLightbox(null)}
        darkMode={darkMode}
      />

    </div>
  );
}
