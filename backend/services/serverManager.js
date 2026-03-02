/**
 * Gestión del estado de servidores Minecraft en memoria.
 * Exporta el mapa `servers` (compartido por referencia) y funciones
 * para refrescar la lista, obtener versión/puerto, etc.
 */
import fs from 'fs';
import path from 'path';
import { status as mcStatus } from 'minecraft-server-util';
import { loadConfig, saveConfig } from '../config/app.js';

// ── Estado compartido ─────────────────────────────────────────────────────────
// Importado por referencia en todas las rutas: las mutaciones son visibles globalmente.
export const servers = {};

let _serverRoot = path.resolve(loadConfig().serverRoot);

export function getServerRoot()    { return _serverRoot; }
export function setServerRoot(root) {
  _serverRoot = root;
  const cfg = loadConfig();
  cfg.serverRoot = root;
  saveConfig(cfg);
}

// ── Utilidades de servidor ────────────────────────────────────────────────────

export function getServerVersion(dir) {
  // 1. Prioridad: cw-mc-modpack.json (versión exacta del fichero instalado)
  try {
    const modpackPath = path.join(dir, 'cw-mc-modpack.json');
    if (fs.existsSync(modpackPath)) {
      const meta = JSON.parse(fs.readFileSync(modpackPath, 'utf-8'));
      const mcVersion = meta.gameVersions?.find(v => /^\d+\.\d+/.test(v));
      if (mcVersion) return mcVersion;
    }
  } catch { /* ignorar */ }

  // 2. Fallback: extraer versión del nombre del JAR
  try {
    const jar = fs.readdirSync(dir).find(f => f.endsWith('.jar'));
    if (jar) {
      const match = jar.match(/(\d+\.\d+(\.\d+)?)/);
      return match ? match[1] : jar;
    }
  } catch { /* directorio inaccesible */ }
  return 'Desconocida';
}

export function getServerPort(dir) {
  try {
    const propsPath = path.join(dir, 'server.properties');
    if (fs.existsSync(propsPath)) {
      const content = fs.readFileSync(propsPath, 'utf-8');
      const match = content.match(/^server-port\s*=\s*(\d+)/m);
      if (match) return parseInt(match[1], 10);
    }
  } catch { /* ignorar */ }
  return 25565;
}

/**
 * Sincroniza la lista en memoria con los directorios presentes en SERVER_ROOT.
 * Añade servidores nuevos, elimina los que ya no existen y no están corriendo.
 */
export function refreshServers() {
  try {
  const serverRoot = _serverRoot;

  if (!fs.existsSync(serverRoot)) {
    fs.mkdirSync(serverRoot, { recursive: true });
    console.log(`Directorio de servidores creado: ${serverRoot}`);
    return;
  }

  const folders = new Set(
    fs.readdirSync(serverRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  );

  // Eliminar entradas cuya carpeta ya no existe (y no están corriendo)
  for (const name of Object.keys(servers)) {
    if (!folders.has(name)) {
      const state = servers[name];
      if (!state.process || state.process.killed) {
        delete servers[name];
        console.log(`Servidor eliminado de la lista: ${name}`);
      }
    }
  }

  // Añadir/actualizar servidores detectados
  for (const folder of folders) {
    const dir = path.join(serverRoot, folder);
    const modpackPath = path.join(dir, 'cw-mc-modpack.json');
    let modpack = null;
    if (fs.existsSync(modpackPath)) {
      try { modpack = JSON.parse(fs.readFileSync(modpackPath, 'utf-8')); } catch { /* ignorar */ }
    }

    if (!servers[folder]) {
      servers[folder] = {
        cfg: {
          name: folder,
          dir,
          host: 'localhost',
          port: getServerPort(dir),
          version: getServerVersion(dir),
          modpack,
        },
        process: null,
        logs: '',
        commandQueue: [],
      };
      console.log(`Servidor detectado: ${folder} (v${servers[folder].cfg.version})`);
    } else {
      // Actualizar modpack por si cw-mc-modpack.json fue creado/modificado
      servers[folder].cfg.modpack = modpack;
    }
  }
  } catch (err) {
    console.error('[refreshServers] Error leyendo el directorio de servidores:', err.message);
  }
}

/**
 * Hace ping a un servidor Minecraft y devuelve su estado en línea.
 * @param {{ host: string, port: number }} cfg
 */
export async function checkMinecraft(cfg) {
  try {
    const s = await mcStatus(cfg.host, cfg.port, { timeout: 2000 });
    return {
      up: true,
      players: {
        online: s.players?.online ?? 0,
        max:    s.players?.max    ?? 0,
        sample: s.players?.sample ?? [],
      },
      motd: s.motd?.clean ?? null,
    };
  } catch {
    return { up: false, players: { online: 0, max: 0, sample: [] } };
  }
}
