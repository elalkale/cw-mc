// ── Constantes compartidas del frontend ──────────────────────────────────────

// Nombres de loaders de CurseForge (classId → nombre)
export const LOADER_NAMES: Record<number, string> = {
  0: 'Any',
  1: 'Forge',
  2: 'Cauldron',
  3: 'LiteLoader',
  4: 'Fabric',
  5: 'Quilt',
  6: 'NeoForge',
};

// Clases Tailwind para cada loader
export const LOADER_COLORS: Record<number, string> = {
  1: 'text-orange-400',
  4: 'text-blue-400',
  5: 'text-purple-400',
  6: 'text-green-400',
};

// ── Paginación ────────────────────────────────────────────────────────────────
export const PAGE_SIZE         = 20;
export const FILES_PER_PAGE    = 15;
export const CATALOG_PAGE_SIZE = 24;

// ── Polling ───────────────────────────────────────────────────────────────────
export const POLL_INTERVAL_MS  = 4000;
export const INSTALL_POLL_MS   = 2000;

// ── Endpoints de la API ───────────────────────────────────────────────────────
export const API = {
  // Auth
  LOGIN:        '/login',
  LOGOUT:       '/logout',
  ME:           '/api/me',

  // Servers
  STATUS:       '/api/status',
  START:        '/api/start',
  STOP:         '/api/stop',
  FORCE_STOP:   '/api/force-stop',
  COMMAND:      '/api/command',
  LOGS:         (name: string) => `/api/logs/${encodeURIComponent(name)}`,
  SERVER_ICON:  (name: string) => `/api/server-icon/${encodeURIComponent(name)}`,

  // Backups
  BACKUP:       (name: string) => `/api/backup/${encodeURIComponent(name)}`,
  BACKUP_LOCAL: (name: string) => `/api/backup/${encodeURIComponent(name)}/local`,

  // Server management
  DELETE_SERVER: (name: string) => `/api/servers/${encodeURIComponent(name)}`,
  CLONE_SERVER:  (name: string) => `/api/servers/${encodeURIComponent(name)}/clone`,
  UPLOAD_SERVER: '/api/servers/upload',

  // Mods
  MODS:          (name: string) => `/api/servers/${encodeURIComponent(name)}/mods`,
  MODS_IDENTIFY: (name: string) => `/api/servers/${encodeURIComponent(name)}/mods/identify`,
  MODS_TOGGLE:   (name: string) => `/api/servers/${encodeURIComponent(name)}/mods/toggle`,
  MODS_DELETE:   (name: string, filename: string) => `/api/servers/${encodeURIComponent(name)}/mods/${encodeURIComponent(filename)}`,
  MODS_INSTALL:  (name: string) => `/api/servers/${encodeURIComponent(name)}/mods/install`,
  MODS_UPLOAD:   (name: string) => `/api/servers/${encodeURIComponent(name)}/mods/upload`,

  // Files
  FILES:         (name: string) => `/api/files/${encodeURIComponent(name)}`,
  FILE_CONTENT:  (name: string) => `/api/files/${encodeURIComponent(name)}/content`,
  FILE_FOLDER:   (name: string) => `/api/files/${encodeURIComponent(name)}/folder`,
  FILE_CREATE:   (name: string) => `/api/files/${encodeURIComponent(name)}/file`,
  FILE_UPLOAD:   (name: string) => `/api/files/${encodeURIComponent(name)}/upload`,
  FILE_DOWNLOAD: (name: string) => `/api/files/${encodeURIComponent(name)}/download`,

  // Install
  INSTALL:       '/api/install',
  INSTALL_STATUS:(id: string) => `/api/install/${id}`,

  // CurseForge
  CF_MODS:       '/api/curseforge/mods',
  CF_MOD:        (modId: number | string) => `/api/curseforge/mod/${modId}`,
  CF_MOD_DESC:   (modId: number | string) => `/api/curseforge/mod/${modId}/description`,
  CF_MOD_FILES:  (modId: number | string) => `/api/curseforge/mod/${modId}/files`,
  CF_MODS_SEARCH:'/api/curseforge/mods/search',
  CF_DOWNLOAD_URL:(modId: number | string, fileId: number | string) =>
    `/api/curseforge/mod/${modId}/file/${fileId}/download-url`,

  // Settings
  SETTINGS:      '/api/settings',

  // Java
  JAVA_STATUS:       '/api/java/status',
  JAVA_DOWNLOAD:     (v: number) => `/api/java/download/${v}`,

  // Server config + properties
  SERVER_CONFIG:     (n: string) => `/api/servers/${encodeURIComponent(n)}/config`,
  SERVER_PROPERTIES: (n: string) => `/api/servers/${encodeURIComponent(n)}/properties`,
} as const;
