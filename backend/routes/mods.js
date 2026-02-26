/**
 * Rutas de gestión de mods de servidores:
 * listar, identificar, toggle (activar/desactivar), eliminar, instalar, subir.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import os from 'os';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { servers } from '../services/serverManager.js';
import { CF_BASE, cfHeaders, cfFingerprint } from '../utils/curseforge.js';
import { CF_API_TOKEN } from '../config/env.js';

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

// GET /api/servers/:name/mods
router.get('/:name/mods', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const state = servers[name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const modsDir = path.join(state.cfg.dir, 'mods');
  if (!fs.existsSync(modsDir)) return res.json({ mods: [], needsIdentification: false });

  try {
    const modsJsonPath = path.join(state.cfg.dir, 'mods.json');
    let modsMetadata = null;
    if (fs.existsSync(modsJsonPath)) {
      try { modsMetadata = JSON.parse(await fs.promises.readFile(modsJsonPath, 'utf-8')); } catch {}
    }

    const files = await fs.promises.readdir(modsDir);
    const mods = await Promise.all(
      files
        .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
        .map(async filename => {
          const stat = await fs.promises.stat(path.join(modsDir, filename));
          const enabled = !filename.endsWith('.disabled');
          const baseName = filename.replace(/\.disabled$/, '');
          const fallbackName = baseName.replace(/\.jar$/, '');
          const meta = modsMetadata?.mods?.[baseName] || {};
          return {
            name: meta.cfName || fallbackName,
            filename,
            enabled,
            size: stat.size,
            logo: meta.logo || null,
            recognized: modsMetadata ? (meta.recognized ?? false) : null,
            modId: meta.modId || null,
            summary: meta.summary || null,
            gameVersions: meta.gameVersions || [],
          };
        })
    );
    mods.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ mods, needsIdentification: !modsMetadata });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:name/mods/identify
router.post('/:name/mods/identify', async (req, res) => {
  const serverName = decodeURIComponent(req.params.name);
  const state = servers[serverName];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const modsDir = path.join(state.cfg.dir, 'mods');
  const modsJsonPath = path.join(state.cfg.dir, 'mods.json');
  const result = { identified_at: new Date().toISOString(), mods: {} };

  if (!fs.existsSync(modsDir)) {
    await fs.promises.writeFile(modsJsonPath, JSON.stringify(result, null, 2), 'utf-8');
    return res.json(result);
  }

  try {
    const files = await fs.promises.readdir(modsDir);
    const jarFiles = files.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));

    if (!jarFiles.length) {
      await fs.promises.writeFile(modsJsonPath, JSON.stringify(result, null, 2), 'utf-8');
      return res.json(result);
    }

    const fpToBase = {};
    for (const filename of jarFiles) {
      const baseName = filename.replace(/\.disabled$/, '');
      const buf = await fs.promises.readFile(path.join(modsDir, filename));
      fpToBase[cfFingerprint(buf)] = baseName;
    }

    if (CF_API_TOKEN) {
      const fpResp = await fetch(`${CF_BASE}/fingerprints/432`, {
        method: 'POST',
        headers: cfHeaders(),
        body: JSON.stringify({ fingerprints: Object.keys(fpToBase).map(Number) }),
      });
      const fpData = await fpResp.json();

      const matchMap = {};
      for (const match of (fpData?.data?.exactMatches || [])) {
        const fp = match.file?.fileFingerprint;
        if (fp) matchMap[fp] = { modId: match.id, fileId: match.file.id, gameVersions: match.file?.gameVersions || [] };
      }

      const modIds = [...new Set(Object.values(matchMap).map(m => m.modId))];
      const modInfoMap = {};
      if (modIds.length) {
        const modsResp = await fetch(`${CF_BASE}/mods`, {
          method: 'POST', headers: cfHeaders(),
          body: JSON.stringify({ modIds }),
        });
        for (const mod of ((await modsResp.json())?.data || [])) {
          modInfoMap[mod.id] = {
            cfName: mod.name, slug: mod.slug,
            logo: mod.logo?.thumbnailUrl || mod.logo?.url || null,
            summary: mod.summary, downloadCount: mod.downloadCount,
          };
        }
      }

      for (const [fp, baseName] of Object.entries(fpToBase)) {
        const match = matchMap[Number(fp)];
        result.mods[baseName] = match
          ? { recognized: true, modId: match.modId, fileId: match.fileId, gameVersions: match.gameVersions || [], ...modInfoMap[match.modId] }
          : { recognized: false };
      }
    } else {
      for (const baseName of Object.values(fpToBase)) {
        result.mods[baseName] = { recognized: false };
      }
    }

    await fs.promises.writeFile(modsJsonPath, JSON.stringify(result, null, 2), 'utf-8');
    res.json(result);
  } catch (err) {
    console.error('Error identificando mods:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:name/mods/toggle
router.post('/:name/mods/toggle', async (req, res) => {
  const serverName = decodeURIComponent(req.params.name);
  const state = servers[serverName];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Falta el nombre del archivo' });

  const modsDir = path.resolve(path.join(state.cfg.dir, 'mods'));
  const currentPath = path.resolve(path.join(modsDir, filename));
  if (!currentPath.startsWith(modsDir + path.sep) && currentPath !== modsDir)
    return res.status(400).json({ error: 'Ruta inválida' });
  if (!fs.existsSync(currentPath)) return res.status(404).json({ error: 'Archivo no encontrado' });

  let newFilename;
  if (filename.endsWith('.jar.disabled')) {
    newFilename = filename.slice(0, -'.disabled'.length);
  } else if (filename.endsWith('.jar')) {
    newFilename = filename + '.disabled';
  } else {
    return res.status(400).json({ error: 'Formato de archivo inválido' });
  }

  await fs.promises.rename(currentPath, path.join(modsDir, newFilename));
  res.json({ ok: true, newFilename });
});

// DELETE /api/servers/:name/mods/:filename
router.delete('/:name/mods/:filename', async (req, res) => {
  const serverName = decodeURIComponent(req.params.name);
  const state = servers[serverName];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const filename = decodeURIComponent(req.params.filename);
  const modsDir = path.resolve(path.join(state.cfg.dir, 'mods'));
  const filePath = path.resolve(path.join(modsDir, filename));
  if (!filePath.startsWith(modsDir + path.sep) && filePath !== modsDir)
    return res.status(400).json({ error: 'Ruta inválida' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });

  await fs.promises.unlink(filePath);

  const modsJsonPath = path.join(state.cfg.dir, 'mods.json');
  if (fs.existsSync(modsJsonPath)) {
    const modsJson = JSON.parse(fs.readFileSync(modsJsonPath, 'utf-8'));
    const baseName = filename.replace(/\.disabled$/, '');
    if (modsJson.mods?.[baseName]) {
      delete modsJson.mods[baseName];
      fs.writeFileSync(modsJsonPath, JSON.stringify(modsJson, null, 2));
    }
  }
  res.json({ ok: true });
});

// POST /api/servers/:name/mods/install
router.post('/:name/mods/install', async (req, res) => {
  const serverName = decodeURIComponent(req.params.name);
  const state = servers[serverName];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { modId, fileId } = req.body;
  if (!modId || !fileId) return res.status(400).json({ error: 'Faltan parámetros: modId y fileId' });

  const modsDir = path.join(state.cfg.dir, 'mods');
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });

  const modsJsonPath = path.join(state.cfg.dir, 'mods.json');
  const modsJson = fs.existsSync(modsJsonPath)
    ? JSON.parse(await fs.promises.readFile(modsJsonPath, 'utf-8'))
    : { identified_at: null, mods: {} };
  if (!modsJson.mods) modsJson.mods = {};

  const downloadMod = async (mId, fId) => {
    for (const [fname, meta] of Object.entries(modsJson.mods)) {
      if (meta.modId === Number(mId)) {
        const base = fname.replace(/\.disabled$/, '');
        for (const candidate of [base, base + '.disabled']) {
          const p = path.join(modsDir, candidate);
          if (fs.existsSync(p)) await fs.promises.unlink(p).catch(() => {});
        }
        delete modsJson.mods[fname];
        break;
      }
    }
    const urlResp = await fetch(`${CF_BASE}/mods/${mId}/files/${fId}/download-url`, { headers: cfHeaders() });
    const downloadUrl = (await urlResp.json())?.data;
    if (!downloadUrl) throw new Error('No se pudo obtener URL de descarga');

    const dlResp = await fetch(downloadUrl);
    if (!dlResp.ok) throw new Error(`Error descargando: ${dlResp.status}`);

    const rawName = decodeURIComponent(downloadUrl.split('/').pop().split('?')[0]);
    const filename = rawName.endsWith('.jar') ? rawName : rawName + '.jar';
    const dest = createWriteStream(path.join(modsDir, filename));
    await new Promise((resolve, reject) => {
      Readable.fromWeb(dlResp.body).pipe(dest);
      dest.on('finish', resolve); dest.on('error', reject);
    });
    return filename;
  };

  try {
    const fileDetailsResp = await fetch(`${CF_BASE}/mods/${modId}/files/${fileId}`, { headers: cfHeaders() });
    const fileDetails = (await fileDetailsResp.json())?.data || {};
    const gameVersions = fileDetails.gameVersions || [];
    const mcVersion = gameVersions.find(v => /^\d+\.\d+/.test(v)) || '';
    const loaderName = gameVersions.find(v => ['Forge', 'Fabric', 'Quilt', 'NeoForge'].includes(v));
    const loaderTypeMap = { Forge: 1, Fabric: 4, Quilt: 5, NeoForge: 6 };
    const loaderType = loaderTypeMap[loaderName] || 0;

    const filename = await downloadMod(modId, fileId);

    const modResp = await fetch(`${CF_BASE}/mods/${modId}`, { headers: cfHeaders() }).catch(() => null);
    const mod = modResp ? (await modResp.json())?.data : null;
    modsJson.mods[filename] = {
      recognized: true, modId: Number(modId), fileId: Number(fileId), gameVersions,
      cfName: mod?.name || null, slug: mod?.slug || null,
      logo: mod?.logo?.thumbnailUrl || mod?.logo?.url || null,
      summary: mod?.summary || null, downloadCount: mod?.downloadCount || null,
    };

    const deps = [];
    const failedDeps = [];
    const requiredDeps = (fileDetails.dependencies || []).filter(d => d.relationType === 3);

    for (const dep of requiredDeps) {
      if (Object.values(modsJson.mods).some(m => m.modId === dep.modId)) continue;
      try {
        const params = new URLSearchParams({ pageSize: '10' });
        if (mcVersion) params.set('gameVersion', mcVersion);
        if (loaderType) params.set('modLoaderType', String(loaderType));
        const depFilesResp = await fetch(`${CF_BASE}/mods/${dep.modId}/files?${params}`, { headers: cfHeaders() });
        const depFiles = (await depFilesResp.json())?.data || [];
        if (!depFiles.length) { failedDeps.push({ modId: dep.modId, error: 'Sin versión compatible' }); continue; }

        const depFileId = depFiles[0].id;
        const depFilename = await downloadMod(dep.modId, depFileId);

        const depModResp = await fetch(`${CF_BASE}/mods/${dep.modId}`, { headers: cfHeaders() }).catch(() => null);
        const depMod = depModResp ? (await depModResp.json())?.data : null;
        modsJson.mods[depFilename] = {
          recognized: true, modId: Number(dep.modId), fileId: Number(depFileId),
          gameVersions: depFiles[0].gameVersions || [], cfName: depMod?.name || null,
          slug: depMod?.slug || null, logo: depMod?.logo?.thumbnailUrl || depMod?.logo?.url || null,
          summary: depMod?.summary || null, downloadCount: depMod?.downloadCount || null,
        };
        deps.push({ modId: dep.modId, name: depMod?.name || depFilename });
      } catch (depErr) {
        console.error(`Error instalando dependencia ${dep.modId}:`, depErr.message);
        failedDeps.push({ modId: dep.modId, error: depErr.message });
      }
    }

    await fs.promises.writeFile(modsJsonPath, JSON.stringify(modsJson, null, 2), 'utf-8');
    res.json({ ok: true, filename, deps, failedDeps });
  } catch (err) {
    console.error('Error instalando mod:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:name/mods/upload
router.post('/:name/mods/upload', upload.array('mods', 20), async (req, res) => {
  const serverName = decodeURIComponent(req.params.name);
  const state = servers[serverName];
  if (!state) {
    for (const f of req.files || []) await fs.promises.unlink(f.path).catch(() => {});
    return res.status(404).json({ error: 'Servidor no encontrado' });
  }

  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  const modsDir = path.join(state.cfg.dir, 'mods');
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });

  const uploaded = [];
  const errors = [];
  for (const file of files) {
    const originalName = file.originalname;
    if (!originalName.endsWith('.jar')) {
      await fs.promises.unlink(file.path).catch(() => {});
      errors.push({ name: originalName, error: 'Solo se permiten archivos .jar' });
      continue;
    }
    const destPath = path.join(modsDir, originalName);
    try {
      await fs.promises.copyFile(file.path, destPath);
      await fs.promises.unlink(file.path);
      uploaded.push(originalName);
    } catch (err) {
      await fs.promises.unlink(file.path).catch(() => {});
      errors.push({ name: originalName, error: err.message });
    }
  }

  if (uploaded.length) {
    await fs.promises.unlink(path.join(state.cfg.dir, 'mods.json')).catch(() => {});
  }
  res.json({ ok: true, uploaded, errors });
});

export default router;
