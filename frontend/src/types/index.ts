// ── Tipos compartidos del panel de administración ────────────────────────────

export interface ServerConfig {
  name: string;
  dir: string;
  host: string;
  port: number;
  version: string;
  modpack: ModpackMeta | null;
}

export interface PlayerInfo {
  online: number;
  max: number;
  sample?: Array<{ name: string; id: string }>;
}

export interface PingResult {
  up: boolean;
  players: PlayerInfo;
  motd?: string | null;
}

export interface ServerStatus {
  running: boolean;
  pid: number | null;
  ping: PingResult;
  icon: string | null;
  version: string;
  players: PlayerInfo;
  modpack: ModpackMeta | null;
}

export type ServersMap = Record<string, ServerStatus>;

// ── Modpacks ──────────────────────────────────────────────────────────────────

export interface ModpackMeta {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  logo?: { url: string; thumbnailUrl?: string } | null;
  gameVersions?: string[];
  loader?: number;
  fileId?: number;
  authors?: Array<{ name: string }>;
  downloadCount?: number;
  categories?: Array<{ id: number; name: string }>;
}

export interface ModpackFile {
  id: number;
  displayName: string;
  fileName: string;
  fileDate: string;
  gameVersions: string[];
  downloadCount: number;
  isServerPack?: boolean;
  serverPackFileId?: number;
}

// ── Mods ──────────────────────────────────────────────────────────────────────

export interface ModEntry {
  name: string;
  filename: string;
  enabled: boolean;
  size: number;
  logo: string | null;
  /** null = aún no identificado, false = no encontrado en CF, true = reconocido */
  recognized: boolean | null;
  modId: number | null;
  summary: string | null;
  gameVersions: string[];
}

// ── Archivos ──────────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

// ── Instalaciones ─────────────────────────────────────────────────────────────

export type InstallStatus = 'pending' | 'installing' | 'done' | 'error';

export interface InstallState {
  installId: string;
  status: InstallStatus;
  serverName: string;
  error?: string | null;
}

// ── API helper ────────────────────────────────────────────────────────────────

export type ApiResponse<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { error: string };
