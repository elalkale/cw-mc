/**
 * Rutas de control de servidores Minecraft:
 * status, start, stop, force-stop, command, logs, backup, clone, delete, upload.
 * Recibe `io` como parámetro para emitir logs por WebSocket.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import multer from 'multer';
import archiver from 'archiver';
import crypto from 'crypto';

import { servers, getServerRoot, refreshServers, checkMinecraft } from '../services/serverManager.js';
import { installs, runInstall } from '../services/installManager.js';
import { killProcess, getStartCommand, extractZip } from '../utils/platform.js';

const upload = multer({ dest: os.tmpdir() });

/**
 * Factory function: recibe io y devuelve el router configurado.
 * @param {import('socket.io').Server} io
 */
export function createServerRoutes(io) {
  const router = express.Router();

  // ── Icono público (sin auth) ───────────────────────────────────────────────
  // NOTA: Esta ruta se monta fuera del apiRouter en index.js
  // Se exporta por separado para mejor organización

  // GET /api/status
  router.get('/status', async (_req, res) => {
    refreshServers();
    const result = {};

    for (const [name, state] of Object.entries(servers)) {
      const running = state.process && !state.process.killed;
      const ping = running
        ? await checkMinecraft(state.cfg).catch(() => ({ up: false, players: { online: 0, max: 0, sample: [] } }))
        : { up: false, players: { online: 0, max: 0, sample: [] } };

      const iconPath = path.join(state.cfg.dir, 'server-icon.png');
      result[name] = {
        running: !!running,
        pid:     running ? state.process.pid : null,
        ping,
        icon:    fs.existsSync(iconPath) ? `/api/server-icon/${encodeURIComponent(name)}` : null,
        version: state.cfg.version,
        players: ping.players,
        modpack: state.cfg.modpack || null,
      };
    }

    res.json(result);
  });

  // POST /api/start
  router.post('/start', (req, res) => {
    refreshServers();
    const { name } = req.body;
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
    if (state.process && !state.process.killed) return res.status(400).json({ error: 'Ya en ejecución' });

    let startCmd;
    try {
      startCmd = getStartCommand(state.cfg.dir);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const child = spawn(startCmd, [], { cwd: state.cfg.dir, shell: true });
    state.process = child;
    state.logs = '';
    state.commandQueue = [];

    const handleOutput = (chunk) => {
      const s = chunk.toString();
      state.logs += s;
      io.to(name).emit('log', { server: name, line: s });
    };

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);

    child.on('error', (err) => {
      const msg = `\n[error al iniciar proceso: ${err.message}]\n`;
      state.logs += msg;
      io.to(name).emit('log', { server: name, line: msg });
      state.process = null;
    });

    child.on('exit', (code, signal) => {
      const msg = `\n[process exited code=${code} signal=${signal}]\n`;
      state.logs += msg;
      io.to(name).emit('log', { server: name, line: msg });
      state.process = null;
    });

    if (child.stdin) {
      for (const cmd of state.commandQueue) child.stdin.write(cmd + '\n');
    }
    state.commandQueue = [];

    res.json({ ok: true, pid: child.pid });
  });

  // POST /api/stop
  router.post('/stop', (req, res) => {
    refreshServers();
    const { name } = req.body;
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
    if (!state.process || state.process.killed) return res.status(400).json({ error: 'No en ejecución' });

    try {
      if (state.process.stdin && !state.process.killed) {
        state.process.stdin.write('stop\n');
        return res.json({ ok: true, method: 'stdin' });
      }
      killProcess(state.process.pid);
      res.json({ ok: true, method: 'kill' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/force-stop
  router.post('/force-stop', (req, res) => {
    refreshServers();
    const { name } = req.body;
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
    if (!state.process || state.process.killed) return res.status(400).json({ error: 'No en ejecución' });

    try {
      killProcess(state.process.pid);
      res.json({ ok: true, method: 'kill' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/logs/:name
  router.get('/logs/:name', (req, res) => {
    const state = servers[req.params.name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
    res.send(state.logs);
  });

  // POST /api/command
  router.post('/command', (req, res) => {
    const { name, command } = req.body;
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

    if (!state.process || state.process.killed) {
      state.commandQueue.push(command);
      return res.status(202).json({ ok: true, queued: true });
    }

    if (state.process.stdin) {
      state.process.stdin.write(command + '\n');
      return res.json({ ok: true, sent: command });
    }

    state.commandQueue.push(command);
    res.status(202).json({ ok: true, queued: true });
  });

  // ── Backups ────────────────────────────────────────────────────────────────

  // GET /api/backup/:name
  router.get('/backup/:name', async (req, res) => {
    const state = servers[req.params.name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

    try {
      const archive = archiver('zip', { zlib: { level: 9 } });
      res.attachment(`${req.params.name}_backup.zip`);
      archive.on('error', (err) => {
        console.error('Error en archiver:', err);
        if (!res.headersSent) res.status(500).send({ error: err.message });
      });
      archive.pipe(res);
      archive.directory(state.cfg.dir, false);
      await archive.finalize();
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ error: 'Error interno al crear el backup' });
    }
  });

  // POST /api/backup/:name/local
  router.post('/backup/:name/local', async (req, res) => {
    const state = servers[req.params.name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

    const worldPath = path.join(state.cfg.dir, 'world');
    try {
      const backupDir = path.join(state.cfg.dir, 'backups');
      await fs.promises.mkdir(backupDir, { recursive: true });

      const dateStr = new Date().toISOString().replace(/\..+/, '').replace(/:/g, '-');
      const filename = `world_backup_${dateStr}.zip`;
      const outputPath = path.join(backupDir, filename);

      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      const archiveEnded = new Promise((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
      });

      archive.pipe(output);
      archive.glob('**/*', { cwd: worldPath, ignore: ['backups/**'] });
      await archive.finalize();
      await archiveEnded;

      res.json({ ok: true, filename });
    } catch (err) {
      console.error('Error creando backup local:', err);
      res.status(500).json({ error: 'Error interno guardando backup local' });
    }
  });

  // ── Gestión de servidores ──────────────────────────────────────────────────

  // DELETE /api/servers/:name
  router.delete('/servers/:name', async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
    if (state.process && !state.process.killed)
      return res.status(400).json({ error: 'Detén el servidor antes de eliminarlo' });

    try {
      await fs.promises.rm(state.cfg.dir, { recursive: true, force: true });
      delete servers[name];
      res.json({ ok: true });
    } catch (err) {
      console.error('Error eliminando servidor:', err);
      res.status(500).json({ error: 'Error al eliminar el servidor' });
    }
  });

  // POST /api/servers/:name/clone
  router.post('/servers/:name/clone', async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const { newName } = req.body;
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
    if (state.process && !state.process.killed)
      return res.status(400).json({ error: 'Detén el servidor antes de clonarlo' });
    if (!newName || !newName.trim())
      return res.status(400).json({ error: 'El nombre del nuevo servidor no puede estar vacío' });

    const destDir = path.join(getServerRoot(), newName.trim());
    if (fs.existsSync(destDir))
      return res.status(409).json({ error: `Ya existe un servidor con el nombre "${newName.trim()}"` });

    try {
      await fs.promises.cp(state.cfg.dir, destDir, { recursive: true });
      refreshServers();
      res.json({ ok: true });
    } catch (err) {
      console.error('Error clonando servidor:', err);
      res.status(500).json({ error: 'Error al clonar el servidor' });
    }
  });

  // POST /api/servers/upload — extrae un ZIP como nuevo servidor (cross-platform)
  router.post('/servers/upload', upload.single('file'), async (req, res) => {
    const serverName = req.body?.serverName?.trim();
    if (!serverName) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Falta el nombre del servidor' });
    }
    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

    const destDir = path.join(getServerRoot(), serverName);
    if (fs.existsSync(destDir)) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ error: `Ya existe un servidor con el nombre "${serverName}"` });
    }

    const zipPath = req.file.path + '.zip';
    try {
      await fs.promises.rename(req.file.path, zipPath);
    } catch (err) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(500).json({ error: 'No se pudo preparar el archivo ZIP' });
    }

    try {
      fs.mkdirSync(destDir, { recursive: true });
      // Usamos extractZip (Node.js puro, sin PowerShell) — funciona en todos los OS
      await extractZip(zipPath, destDir);
      await fs.promises.unlink(zipPath);
      refreshServers();
      res.json({ ok: true });
    } catch (err) {
      await fs.promises.unlink(zipPath).catch(() => {});
      await fs.promises.rm(destDir, { recursive: true, force: true }).catch(() => {});
      console.error('Error subiendo servidor:', err);
      res.status(500).json({ error: err.message || 'Error al extraer el servidor' });
    }
  });

  // ── Instalación de server packs ────────────────────────────────────────────

  // POST /api/install
  router.post('/install', (req, res) => {
    const { modId, fileId, serverName, meta } = req.body;
    if (!modId || !fileId || !serverName) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }

    const destDir = path.join(getServerRoot(), serverName);
    if (fs.existsSync(destDir)) {
      return res.status(409).json({ error: `Ya existe un servidor con el nombre "${serverName}"` });
    }

    const installId = crypto.randomUUID();
    installs[installId] = { status: 'pending', error: null, serverName };

    runInstall(installId, modId, fileId, destDir, meta ?? null); // sin await → background

    res.json({ installId });
  });

  // GET /api/install/:installId
  router.get('/install/:installId', (req, res) => {
    const entry = installs[req.params.installId];
    if (!entry) return res.status(404).json({ error: 'Instalación no encontrada' });
    res.json(entry);
  });

  return router;
}

/**
 * Función de shutdown: mata todos los procesos Minecraft activos.
 * Se llama desde los listeners SIGINT / SIGTERM.
 * @param {string} signal
 */
export function shutdown(signal) {
  console.log(`\n[${signal}] Apagando backend...`);
  const running = Object.values(servers).filter(s => s.process && !s.process.killed);

  if (running.length === 0) {
    process.exit(0);
  }

  let pending = running.length;
  const done = () => { if (--pending === 0) process.exit(0); };

  for (const state of running) {
    try {
      killProcess(state.process.pid);
      // Escuchar el exit del proceso para saber cuándo terminó
      state.process.once('exit', done);
      state.process.once('error', done);
    } catch {
      done();
    }
  }

  // Salida forzada tras 8s si algún proceso no responde
  setTimeout(() => process.exit(0), 8000).unref();
}
