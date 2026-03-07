/**
 * Rutas del catálogo de modpacks:
 * - GET  /api/modpacks                — devuelve el JSON guardado en disco
 * - GET  /api/modpacks/refresh/status — estado del proceso de actualización
 * - POST /api/modpacks/refresh        — lanza la actualización en segundo plano
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CF_API_TOKEN } from '../config/env.js';

const router = express.Router();

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR    = path.join(__dirname, '../data');
const JSON_PATH   = path.join(DATA_DIR, 'modpacks_with_server.json');

function resolveJsonPath() {
  return fs.existsSync(JSON_PATH) ? JSON_PATH : null;
}

const CF_BASE    = 'https://api.curseforge.com/v1';
const cfHeaders  = () => ({ 'Accept': 'application/json', 'x-api-key': CF_API_TOKEN });

const GAME_ID   = 432;
const CLASS_ID  = 4471;
const PAGE_SIZE = 50;

const GAME_VERSIONS = [
  '1.21.4','1.21.3','1.21.2','1.21.1','1.21',
  '1.20.6','1.20.5','1.20.4','1.20.3','1.20.2','1.20.1','1.20',
  '1.19.4','1.19.3','1.19.2','1.19.1','1.19',
  '1.18.2','1.18.1','1.18',
  '1.17.1','1.17',
  '1.16.5','1.16.4','1.16.3','1.16.2','1.16.1','1.16',
  '1.15.2','1.15.1','1.15',
  '1.14.4','1.14.3','1.14.2','1.14.1','1.14',
  '1.13.2','1.13.1','1.13',
  '1.12.2','1.12.1','1.12',
  '1.11.2','1.11',
  '1.10.2','1.10',
  '1.9.4','1.9',
  '1.8.9','1.8.8','1.8',
  '1.7.10','1.7.2',
  '1.6.4','1.6.2',
  '1.5.2','1.5',
  '1.4.7','1.4.2',
  '1.3.2','1.2.5','1.1','1.0',
];
const MOD_LOADERS = [1, 4, 5, 6]; // Forge, Fabric, Quilt, NeoForge

// ── Estado de actualización ────────────────────────────────────────────────────
const _initPath = resolveJsonPath();
let refreshState = {
  running: false,
  startedAt: null,
  lastUpdated: _initPath ? fs.statSync(_initPath).mtime.toISOString() : null,
  progress: { version: null, loader: null, found: 0 },
};

// ── GET /api/modpacks ──────────────────────────────────────────────────────────
router.get('/', (_req, res) => {
  const filePath = resolveJsonPath();
  if (!filePath) return res.json([]);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(Array.isArray(data) ? data : []);
  } catch {
    res.json([]);
  }
});

// ── GET /api/modpacks/refresh/status ──────────────────────────────────────────
router.get('/refresh/status', (req, res) => {
  res.json(refreshState);
});

// ── POST /api/modpacks/refresh ────────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  if (refreshState.running) {
    return res.status(409).json({ error: 'Ya hay una actualización en curso' });
  }
  if (!CF_API_TOKEN) {
    return res.status(400).json({ error: 'CF_API_TOKEN no configurado' });
  }

  refreshState = { running: true, startedAt: new Date().toISOString(), lastUpdated: refreshState.lastUpdated, progress: { version: null, loader: null, found: 0 } };
  res.json({ started: true });

  // Fire-and-forget
  runRefresh().catch(err => {
    console.error('[modpacks refresh] Error:', err.message);
    refreshState.running = false;
  });
});

async function runRefresh() {
  const LOADER_NAMES = { 1: 'Forge', 4: 'Fabric', 5: 'Quilt', 6: 'NeoForge' };
  const modpacksMap = new Map();

  for (const version of GAME_VERSIONS) {
    for (const loader of MOD_LOADERS) {
      refreshState.progress = { version, loader: LOADER_NAMES[loader] ?? loader, found: modpacksMap.size };

      let index = 0;
      while (true) {
        if (index + PAGE_SIZE > 10000) break;

        await new Promise(r => setTimeout(r, 500)); // rate-limit

        const url =
          `${CF_BASE}/mods/search?gameId=${GAME_ID}&classId=${CLASS_ID}` +
          `&gameVersion=${version}&modLoaderType=${loader}` +
          `&sortField=3&sortOrder=desc&pageSize=${PAGE_SIZE}&index=${index}`;

        let data;
        try {
          const resp = await fetch(url, { headers: cfHeaders() });
          if (!resp.ok) { await new Promise(r => setTimeout(r, 2000)); continue; }
          data = await resp.json();
        } catch {
          break;
        }

        if (!data?.data?.length) break;

        for (const mod of data.data) {
          if (modpacksMap.has(mod.id)) continue;

          let serverFileId;
          for (const file of (mod.latestFiles || [])) {
            if (file.serverPackFileId) { serverFileId = file.serverPackFileId; break; }
          }
          if (!serverFileId) continue;

          modpacksMap.set(mod.id, {
            modId: mod.id,
            name: mod.name,
            slug: mod.slug,
            downloadCount: mod.downloadCount,
            gamePopularityRank: mod.gamePopularityRank,
            thumbsUpCount: mod.thumbsUpCount,
            isFeatured: mod.isFeatured,
            isAvailable: mod.isAvailable,
            primaryCategoryId: mod.primaryCategoryId,
            categories: (mod.categories || []).map(c => c.id),
            modLoaders: [...new Set((mod.latestFilesIndexes || []).map(f => f.modLoader).filter(Boolean))],
            gameVersions: [...new Set((mod.latestFilesIndexes || []).map(f => f.gameVersion).filter(Boolean))],
            versionInfo: (() => {
              const map = {};
              for (const f of (mod.latestFilesIndexes || [])) {
                if (!f.gameVersion) continue;
                if (!map[f.gameVersion]) map[f.gameVersion] = { releaseType: f.releaseType ?? 1, loaders: [] };
                const vi = map[f.gameVersion];
                if ((f.releaseType ?? 1) < vi.releaseType) vi.releaseType = f.releaseType ?? 1;
                if (f.modLoader && !vi.loaders.includes(f.modLoader)) vi.loaders.push(f.modLoader);
              }
              return map;
            })(),
            dateCreated: mod.dateCreated,
            dateModified: mod.dateModified,
            dateReleased: mod.dateReleased,
            serverFileId,
          });
        }

        index += PAGE_SIZE;
      }
    }
  }

  const result = Array.from(modpacksMap.values());
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(JSON_PATH, JSON.stringify(result, null, 2), 'utf-8');

  refreshState.running = false;
  refreshState.lastUpdated = new Date().toISOString();
  refreshState.progress = { version: null, loader: null, found: result.length };
  console.log(`[modpacks refresh] Completado: ${result.length} modpacks guardados.`);
}

export default router;
