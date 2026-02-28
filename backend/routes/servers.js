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
import axios from 'axios';

import { servers, getServerRoot, refreshServers, checkMinecraft } from '../services/serverManager.js';
import { installs, runInstall } from '../services/installManager.js';
import { killProcess, getStartCommand, extractZip, isWindows } from '../utils/platform.js';
import { getMcJavaVersion, getJavaExe, getJavaDir, isJavaReady } from '../services/javaManager.js';

/**
 * Genera start-server.bat y start-server.sh en el directorio del servidor
 * cuando no existe ningún script de inicio. Invoca java directamente.
 * @param {string} serverDir
 * @param {string} mcVersion
 * @returns {string} nombre del script generado según la plataforma
 */
async function createFallbackStartScript(serverDir, mcVersion) {
  const javaVer = getMcJavaVersion(mcVersion);
  const javaD = isJavaReady(javaVer) ? getJavaDir(javaVer) : null;
  const javaNote = javaD
    ? `Java ${javaVer} gestionado: ${javaD}`
    : `Java ${javaVer} requerido — descárgalo desde el panel`;

  // Leer JAR configurado; si no hay, usar 'server.jar' como fallback
  let serverJar = 'server.jar';
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(serverDir, 'cw-mc-config.json'), 'utf-8'));
    if (cfg.serverJar) serverJar = cfg.serverJar;
  } catch { }

  // ── Windows ─────────────────────────────────────────────────────────────
  const batContent = [
    '@echo off',
    `REM Generado por CW-MC — ${javaNote}`,
    '',
    javaD ? `SET "JAVA_HOME=${javaD}"` : 'REM Java gestionado no disponible, usando java del PATH',
    javaD ? 'SET "PATH=%JAVA_HOME%\\bin;%PATH%"' : '',
    '',
    `java -Xmx4G -Xms1G -jar "${serverJar}" nogui`,
    'pause',
  ].filter(l => l !== undefined).join('\r\n');

  await fs.promises.writeFile(path.join(serverDir, 'start-server.bat'), batContent, 'utf-8');

  // ── Linux / macOS ────────────────────────────────────────────────────────
  const shContent = [
    '#!/usr/bin/env bash',
    `# Generado por CW-MC — ${javaNote}`,
    '',
    javaD ? `export JAVA_HOME="${javaD}"` : '# Java gestionado no disponible, usando java del PATH',
    javaD ? 'export PATH="$JAVA_HOME/bin:$PATH"' : '',
    '',
    `java -Xmx4G -Xms1G -jar "${serverJar}" nogui`,
  ].filter(l => l !== undefined).join('\n');

  await fs.promises.writeFile(path.join(serverDir, 'start-server.sh'), shContent, 'utf-8');
  if (!isWindows) {
    try { fs.chmodSync(path.join(serverDir, 'start-server.sh'), 0o755); } catch { /* ignorar */ }
  }

  return isWindows ? 'start-server.bat' : 'start-server.sh';
}

// Propiedades de server.properties que este panel puede leer y editar
const MANAGED_PROPS = ['motd', 'max-players', 'difficulty', 'gamemode', 'white-list', 'pvp', 'view-distance', 'level-seed', 'online-mode'];

const upload = multer({ dest: os.tmpdir() });

/**
 * Factory function: recibe io y devuelve el router configurado.
 * @param {import('socket.io').Server} io
 */
export function createServerRoutes(io) {
  const router = express.Router();

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
        pid: running ? state.process.pid : null,
        ping,
        icon: fs.existsSync(iconPath) ? `/api/server-icon/${encodeURIComponent(name)}` : null,
        version: state.cfg.version,
        players: ping.players,
        modpack: state.cfg.modpack || null,
      };
    }

    res.json(result);
  });

  // POST /api/start
  router.post('/start', async (req, res) => {
    refreshServers();
    const { name } = req.body;
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
    if (state.process && !state.process.killed) return res.status(400).json({ error: 'Ya en ejecución' });

    // Leer configuración del servidor (script, java, jar)
    const serverCfgPath = path.join(state.cfg.dir, 'cw-mc-config.json');
    let cwCfg = {};
    try { cwCfg = JSON.parse(fs.readFileSync(serverCfgPath, 'utf-8')); } catch { }

    // Determinar script de inicio: config manual → auto-detección → generar fallback
    let startCmd;
    const configuredScript = cwCfg.startScript || null;
    if (configuredScript && fs.existsSync(path.join(state.cfg.dir, configuredScript))) {
      startCmd = configuredScript;
    } else {
      try {
        startCmd = getStartCommand(state.cfg.dir);
      } catch {
        // No existe ningún script de inicio — generar start-server.bat / start-server.sh
        try {
          startCmd = await createFallbackStartScript(state.cfg.dir, state.cfg.version);
          const msg = `[CW-MC] No se encontró script de inicio. Se ha generado ${startCmd} automáticamente.\n`;
          state.logs += msg;
          io.to(name).emit('log', { server: name, line: msg });
        } catch (genErr) {
          return res.status(500).json({ error: `No se pudo crear el script de inicio: ${genErr.message}` });
        }
      }
    }

    // Determinar java a usar: config manual → JRE gestionado → herencia del sistema
    let javaPath = cwCfg.javaPath || null;
    if (!javaPath) {
      const javaVer = getMcJavaVersion(state.cfg.version);
      if (isJavaReady(javaVer)) javaPath = getJavaExe(javaVer);
    }

    let spawnEnv = process.env;
    if (javaPath) {
      const javaDir = path.resolve(path.dirname(javaPath), '..');
      spawnEnv = {
        ...process.env,
        JAVA_HOME: javaDir,
        PATH: isWindows
          ? `${javaDir}\\bin;${process.env.PATH ?? ''}`
          : `${javaDir}/bin:${process.env.PATH ?? ''}`,
      };
    }

    const child = spawn(startCmd, [], { cwd: state.cfg.dir, shell: true, env: spawnEnv });
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
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => { });
      return res.status(400).json({ error: 'Falta el nombre del servidor' });
    }
    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

    const destDir = path.join(getServerRoot(), serverName);
    if (fs.existsSync(destDir)) {
      await fs.promises.unlink(req.file.path).catch(() => { });
      return res.status(409).json({ error: `Ya existe un servidor con el nombre "${serverName}"` });
    }

    const zipPath = req.file.path + '.zip';
    try {
      await fs.promises.rename(req.file.path, zipPath);
    } catch (err) {
      await fs.promises.unlink(req.file.path).catch(() => { });
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
      await fs.promises.unlink(zipPath).catch(() => { });
      await fs.promises.rm(destDir, { recursive: true, force: true }).catch(() => { });
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

  // ── Configuración por servidor (Java path) ────────────────────────────────

  // GET /api/servers/:name/config
  router.get('/servers/:name/config', (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

    const cfgPath = path.join(state.cfg.dir, 'cw-mc-config.json');
    let javaPath = null, serverJar = null, startScript = null;
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      javaPath = cfg.javaPath ?? null;
      serverJar = cfg.serverJar ?? null;
      startScript = cfg.startScript ?? null;
    } catch { }

    // Listar JARs y scripts en el directorio del servidor
    let jarFiles = [], scriptFiles = [];
    try {
      const entries = fs.readdirSync(state.cfg.dir);
      jarFiles = entries.filter(f => f.endsWith('.jar')).sort();
      scriptFiles = entries.filter(f => f.endsWith('.bat') || f.endsWith('.sh')).sort();
    } catch { }

    const requiredVersion = getMcJavaVersion(state.cfg.version);
    const managedReady = isJavaReady(requiredVersion);
    const managedPath = managedReady ? getJavaExe(requiredVersion) : null;

    res.json({ javaPath, requiredVersion, managedReady, managedPath, serverJar, jarFiles, startScript, scriptFiles });
  });

  // POST /api/servers/:name/config
  router.post('/servers/:name/config', async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

    const { javaPath, serverJar, startScript } = req.body;
    const cfgPath = path.join(state.cfg.dir, 'cw-mc-config.json');

    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')); } catch { }

    await fs.promises.writeFile(cfgPath, JSON.stringify({
      ...existing,
      javaPath: javaPath !== undefined ? (javaPath || null) : existing.javaPath,
      serverJar: serverJar !== undefined ? (serverJar || null) : existing.serverJar,
      startScript: startScript !== undefined ? (startScript || null) : existing.startScript,
    }, null, 2), 'utf-8');

    // Regenerar start-server.bat / start-server.sh con la nueva configuración
    try {
      const { generateStartScripts } = await import('../services/installManager.js');
      await generateStartScripts(state.cfg.dir, state.cfg.version);
    } catch { /* ignorar si no hay scripts que regenerar */ }

    res.json({ ok: true, scriptsRegenerated: true });
  });

  // ── server.properties ─────────────────────────────────────────────────────

  // GET /api/servers/:name/properties
  router.get('/servers/:name/properties', (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

    const propsPath = path.join(state.cfg.dir, 'server.properties');
    if (!fs.existsSync(propsPath)) return res.json({ exists: false, properties: {} });

    const properties = {};
    for (const line of fs.readFileSync(propsPath, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m && MANAGED_PROPS.includes(m[1].trim())) {
        properties[m[1].trim()] = m[2].trim();
      }
    }
    res.json({ exists: true, properties });
  });

  // POST /api/servers/:name/properties
  router.post('/servers/:name/properties', async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const state = servers[name];
    if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

    const propsPath = path.join(state.cfg.dir, 'server.properties');
    if (!fs.existsSync(propsPath)) return res.status(404).json({ error: 'No se encontró server.properties' });

    const { properties } = req.body;
    if (!properties || typeof properties !== 'object') return res.status(400).json({ error: 'Se esperan propiedades como objeto' });

    let content = fs.readFileSync(propsPath, 'utf-8');
    for (const [key, value] of Object.entries(properties)) {
      if (!MANAGED_PROPS.includes(key)) continue;
      const val = String(value);
      const regex = new RegExp(`^(${key.replace('-', '\\-')}\\s*=).*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `$1${val}`);
      } else {
        content += `\n${key}=${val}`;
      }
    }

    await fs.promises.writeFile(propsPath, content, 'utf-8');
    res.json({ ok: true });
  });

  // ── Create server from scratch ──────────────────────────────────────────

  /**
   * Descarga el server.jar correcto basado en versión y modloader.
   * @param {string} version - p.ej. '1.21.4'
   * @param {string} modLoader - 'vanilla', 'forge', 'fabric', 'quilt', 'neoforge'
   * @param {string} destPath - ruta donde guardar el JAR
   * @param {string} loaderVersion - versión específica del loader (ej: Fabric 0.14.0)
   */
  /**
   * Ejecuta el instalador de Forge con --installServer
   * El JAR descargado de maven es el instalador, solo necesita ejecutarse con --installServer
   */
  async function installForgeServer(serverDir, version, loaderVersion, serverJarPath) {
    return new Promise((resolve, reject) => {
      // Usar 'java' de java los javas descargados por el panel (si es compatible), o fallback al java del sistema
      const javaVer = getMcJavaVersion(version);
      const javaExe = isJavaReady(javaVer) ? getJavaExe(javaVer) : 'java';

      const proc = spawn(javaExe,
        ['-jar', serverJarPath, '--installServer'],
        { cwd: serverDir, stdio: 'pipe' }
      );

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
        console.log(`[FORGE-INSTALL] ${data.toString().trim()}`);
      });
      proc.stderr?.on('data', (data) => {
        output += data.toString();
        console.log(`[FORGE-INSTALL] ERROR: ${data.toString().trim()}`);
      });

      proc.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Forge installer terminó con código ${code}`));
          return;
        }
        console.log(`[FORGE] Instalación completada exitosamente`);
        resolve();
      });

      proc.on('error', (err) => {
        reject(new Error(`Error ejecutando Forge installer: ${err.message}`));
      });
    });
  }

  async function installQuiltServer(serverDir, version, loaderVersion, installerPath) {
    return new Promise((resolve, reject) => {

      const javaVer = getMcJavaVersion(version);
      const javaExe = isJavaReady(javaVer)
        ? getJavaExe(javaVer)
        : 'java';

      const args = [
        '-jar',
        installerPath,
        'install',
        'server',
        version,
        loaderVersion,
        `--install-dir=${serverDir}`,
        '--download-server',
        '--create-scripts'
      ];

      const proc = spawn(javaExe, args, {
        cwd: serverDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      proc.stdout.on('data', d =>
        console.log('[QUILT-INSTALL]', d.toString().trim())
      );

      proc.stderr.on('data', d =>
        console.log('[QUILT-INSTALL][ERR]', d.toString().trim())
      );

      proc.on('close', code => {
        if (code !== 0)
          return reject(new Error(`Installer terminó con código ${code}`));

        console.log('[QUILT] Instalación completada');
        resolve();
      });

      proc.on('error', reject);
    });
  }



  async function getFabricLatestStableInstaller() {
    const { data } = await axios.get(
      "https://meta.fabricmc.net/v2/versions/installer"
    );

    const latestStable = data.find(v => v.stable);

    return latestStable;
  }

  async function downloadServerJar(version, modLoader, destPath, loaderVersion, serverDir) {
    if (modLoader === 'vanilla') {
      // Descarga desde launcher.mojang.com
      try {
        const manifestRes = await axios.get('https://launcher.mojang.com/v1/objects/8f3112a1311e4c80fce50aee56658498d1dcbda4/version_manifest.json');
        const manifest = manifestRes.data;
        const versionObj = manifest.versions.find(v => v.id === version);
        if (!versionObj) throw new Error(`Versión vanilla ${version} no encontrada`);

        const versionRes = await axios.get(versionObj.url);
        const versionData = versionRes.data;

        const serverRes = await axios.get(versionData.downloads.server.url, { responseType: 'arraybuffer' });
        await fs.promises.writeFile(destPath, serverRes.data);
        return;
      } catch (err) {
        throw new Error(`Error descargando vanilla ${version}: ${err.message}`);
      }
    }

    if (modLoader === 'fabric') {
      try {
        // Usar la versión del loader especificada

        const latestInstaller = await getFabricLatestStableInstaller();
        if (!latestInstaller) throw new Error('No se pudo obtener la última versión estable de Fabric Installer');

        const launcherRes = await axios.get(
          `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVersion}/${latestInstaller.version}/server/jar`,
          { responseType: 'arraybuffer' }
        );

        await fs.promises.writeFile(destPath, launcherRes.data);
        return;
      } catch (err) {
        throw new Error(`Error descargando Fabric ${loaderVersion}: ${err.message}`);
      }
    }

    if (modLoader === 'forge') {
      try {
        const forgeUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${loaderVersion}/forge-${loaderVersion}-installer.jar`;
        console.log(`[FORGE] Descargando JAR instalador: ${forgeUrl}`);
        const res = await axios.get(forgeUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        // Guardar el JAR directamente como server.jar
        await fs.promises.writeFile(destPath, res.data);
        console.log(`[FORGE] JAR descargado como server.jar, ejecutando --installServer...`);

        // Ejecutar el instalador: java -jar server.jar --installServer
        await installForgeServer(serverDir, version, loaderVersion, destPath);
        console.log(`[FORGE] Instalación exitosa`);
        return;
      } catch (err) {
        throw new Error(`Error instalando Forge ${version}-${loaderVersion}: ${err.message}`);
      }
    }

    if (modLoader === 'neoforge') {
      try {
        const forgeUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVersion}/neoforge-${loaderVersion}-installer.jar`;
        const res = await axios.get(forgeUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        // Guardar el JAR directamente como server.jar
        await fs.promises.writeFile(destPath, res.data);
        console.log(`[FORGE] JAR descargado como server.jar, ejecutando --installServer...`);

        // Ejecutar el instalador: java -jar server.jar --installServer
        await installForgeServer(serverDir, version, loaderVersion, destPath);
        console.log(`[FORGE] Instalación exitosa`);
        return;
      } catch (err) {
        throw new Error(`Error instalando Forge ${version}-${loaderVersion}: ${err.message}`);
      }

    }

    if (modLoader === 'quilt') {
      try {
        // 1️⃣ obtener installer estable
        const { data } = await axios.get(
          'https://meta.quiltmc.org/v3/versions/installer'
        );

        // Elegir el último installer
        const installer = data.find(v => v.stable) || data[0];

        const url = `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/${installer.version}/quilt-installer-${installer.version}.jar`;

        // 2️⃣ descargar installer
        const res = await axios.get(url, {
          responseType: 'arraybuffer'
        });
        const installerDestPath = path.join(serverDir, `quilt-installer-${installer.version}.jar`);

        await fs.promises.writeFile(installerDestPath, res.data);

        // 3️⃣ ejecutar installer: java -jar quilt-installer.jar install server <version> --loader <loaderVersion> --download-server
        await installQuiltServer(serverDir, version, loaderVersion, installerDestPath);

        return;
      } catch (err) {
        throw new Error(`Error descargando Quilt installer: ${err.message}`);
      }
    }

    throw new Error(`Modloader ${modLoader} no soportado`);
  }

  /**
   * Descarga y parsea maven-metadata.xml de Forge
   * Formato de versión en maven: "1.20.1-47.4.16" = MC 1.20.1, Forge 47.4.16
   * @returns {Promise<Object>} { mcVersion: [forgeVersions], ... }
   */
  async function getForgeMavenVersions() {
    try {
      console.log('[FETCH] Obteniendo Forge versions del maven...');
      const res = await axios.get('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml', {
        timeout: 10000,
      });
      const xmlText = res.data;

      // Parsear XML simple (sin dependencias)
      const versionMatches = xmlText.match(/<version>(.*?)<\/version>/g) || [];
      const versions = versionMatches.map(v => v.replace(/<\/?version>/g, ''));

      console.log(`[FORGE] Total de versiones encontradas: ${versions.length}`);

      // Agrupar por versión de MC: "1.20.1-47.4.16" → { "1.20.1": ["47.4.16", ...] }
      const grouped = {};
      for (const ver of versions) {
        // Formato: "1.20.1-47.4.16" → MC=1.20.1, Forge=47.4.16
        const lastDash = ver.lastIndexOf('-');
        if (lastDash === -1) continue;

        const mcVer = ver.substring(0, lastDash);
        const forgeVer = ver;

        if (!grouped[mcVer]) grouped[mcVer] = [];
        grouped[mcVer].push(forgeVer);
      }

      // Ordenar versiones de Forge de mayor a menor
      for (const mcVer in grouped) {
        grouped[mcVer].sort((a, b) => {
          const aParts = a.split('.').map(Number);
          const bParts = b.split('.').map(Number);
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aDiff = (bParts[i] || 0) - (aParts[i] || 0);
            if (aDiff !== 0) return aDiff;
          }
          return 0;
        });
      }

      console.log(`[FORGE] MC versions con Forge: ${Object.keys(grouped).length}`);

      return grouped;
    } catch (err) {
      console.error('Error fetching Forge versions:', err.message);
      return {};
    }
  }

  /**
   * Descarga y parsea maven-metadata.xml de NeoForge
   * Formato de versión en maven: "1.20.1-2.0.0" = MC 1.20.1, NeoForge 2.0.0
   * @returns {Promise<Object>} { mcVersion: [forgeVersions], ... }
   */
  async function getNeoForgeMavenVersions() {
  try {
    console.log('[FETCH] Obteniendo NeoForge versions del maven...');
    const res = await axios.get(
      'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml',
      { timeout: 10000 }
    );
    const xmlText = res.data;

    // Extraer todas las versiones
    const versionMatches = xmlText.match(/<version>(.*?)<\/version>/g) || [];
    const versions = versionMatches.map(v => v.replace(/<\/?version>/g, ''));

    console.log(`[FORGE] Total de versiones encontradas: ${versions.length}`);

    // Agrupar por versión de MC
    const grouped = {};
    for (const ver of versions) {
      // Extraer solo los números principales (antes del primer "-")
      const mainPart = ver.split('-')[0]; // "21.1.61-beta" → "21.1.61" | "21.1.61" → "21.1.61"
      const parts = mainPart.split('.'); // ["21","1","61"]

      // Formar la versión MC: "1.<major>.<minor>"
      // Tomamos los dos primeros números
      const mcVer = parts.length >= 2 ? `1.${parts[0]}.${parts[1]}` : `1.${parts[0]}.0`;

      if (!grouped[mcVer]) grouped[mcVer] = [];
      grouped[mcVer].push(ver);
    }

    console.log(`[NEOFORGE] MC versions con NeoForge: ${Object.keys(grouped).length}`);
    return grouped;
  } catch (err) {
    console.error('Error fetching NeoForge versions:', err.message);
    return {};
  }
}

  /**
   * Obtiene las versiones de Minecraft disponibles para un modloader específico
   * @param {string} modLoader - 'vanilla', 'forge', 'fabric', etc.
   * @returns {Promise<string[]>}
   */
  async function getMcVersions(modLoader) {
    try {
      if (modLoader === 'vanilla') {
        console.log('[VANILLA] Obteniendo versiones...');
        const manifestRes = await axios.get('https://launcher.mojang.com/v1/objects/8f3112a1311e4c80fce50aee56658498d1dcbda4/version_manifest.json');
        const versions = manifestRes.data.versions
          .filter(v => /^\d+\.\d+/.test(v.id) && v.type === 'release')
          .map(v => v.id)
          .sort((a, b) => {
            const pa = a.split('.').map(Number);
            const pb = b.split('.').map(Number);
            for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
            return 0;
          });
        console.log(`[VANILLA] Encontradas ${versions.length} versiones`);
        return versions;
      }

      if (modLoader === 'fabric') {
        console.log('[FABRIC] Obteniendo versiones...');
        const versionsRes = await axios.get('https://meta.fabricmc.net/v2/versions/game');
        const versions = versionsRes.data.filter(v => v.stable).map(v => v.version);
        console.log(`[FABRIC] Encontradas ${versions.length} versiones`);
        return versions;
      }

      if (modLoader === 'forge') {
        console.log('[FORGE] Obteniendo versiones...');
        const forgeVersions = await getForgeMavenVersions();
        const mcVersions = Object.keys(forgeVersions).sort((a, b) => {
          const pa = a.split('.').map(Number);
          const pb = b.split('.').map(Number);
          for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
          return 0;
        });
        console.log(`[FORGE] Encontradas ${mcVersions.length} versiones de MC`);
        return mcVersions;
      }
      if (modLoader === 'quilt') {
        console.log('[QUILT] Obteniendo versiones...');

        const { data } = await axios.get(
          'https://meta.quiltmc.org/v3/versions/game'
        );

        const versions = data
          .filter(v => v.stable === true && v.version)
          .map(v => v.version)
          .sort((a, b) =>
            b.localeCompare(a, undefined, { numeric: true })
          );

        console.log(`[QUILT] Encontradas ${versions.length} versiones`);

        return versions;
      }

      if (modLoader === 'neoforge') {
        console.log('[NEOFORGE] Obteniendo versiones...');
        const neoForgeVersions = await getNeoForgeMavenVersions();
        const mcVersions = Object.keys(neoForgeVersions).sort((a, b) => {
          const pa = a.split('.').map(Number);
          const pb = b.split('.').map(Number);
          for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
          return 0;
        });
        console.log(`[NEOFORGE] Encontradas ${mcVersions.length} versiones de MC`);
        return mcVersions;
      }

      console.warn(`[MC_VERSIONS] Modloader desconocido: ${modLoader}`);
      return [];
    } catch (err) {
      console.error(`Error fetching MC versions for ${modLoader}:`, err.message, err.code);
      return [];
    }
  }

  /**
   * Obtiene las versiones de un modloader específico para una versión de MC
   * @param {string} modLoader
   * @param {string} mcVersion
   * @returns {Promise<string[]>}
   */
  async function getLoaderVersions(modLoader, mcVersion) {
    try {
      if (modLoader === 'fabric') {
        console.log(`[FABRIC] Obteniendo versiones para MC ${mcVersion}...`);
        const loaderRes = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
        const versions = loaderRes.data.map(m => m.loader.version).slice(0, 20); // Top 20
        console.log(`[FABRIC] Encontradas ${versions.length} versiones`);
        return versions;
      }

      if (modLoader === 'forge') {
        console.log(`[FORGE] Obteniendo versiones para MC ${mcVersion}...`);
        const forgeVersions = await getForgeMavenVersions();
        const loaderVers = forgeVersions[mcVersion] || [];
        console.log(`[FORGE] Encontradas ${loaderVers.length} versiones`, loaderVers.slice(0, 5));
        return loaderVers;
      }

      if (modLoader === 'quilt') {
        console.log(`[QUILT] Obteniendo versiones para MC ${mcVersion}...`);
        const loaderRes = await axios.get(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`);
        const versions = loaderRes.data.map(m => m.loader.version).slice(0, 20);
        console.log(`[QUILT] Encontradas ${versions.length} versiones`);
        return versions;
      }

      if (modLoader === 'neoforge') {
        console.log(`[NEOFORGE] Devolviendo versiones para MC ${mcVersion}...`);
        // NeoForge versions (simplified)

        const neoForgeVersions = await getNeoForgeMavenVersions();
        const loaderVers = neoForgeVersions[mcVersion] || [];
        console.log(`[NEOFORGE] Encontradas ${loaderVers.length} versiones`, loaderVers.slice(0, 5));
        return loaderVers;
      }

      console.warn(`[LOADER_VERSIONS] Modloader desconocido: ${modLoader} para MC ${mcVersion}`);
      return [];
    } catch (err) {
      console.error(`Error fetching loader versions for ${modLoader} ${mcVersion}:`, err.message, err.code);
      return [];
    }
  }

  // GET /api/servers/versions
  router.get('/servers/versions', async (req, res) => {
    const { modLoader } = req.query;
    console.log(`[API] GET /servers/versions?modLoader=${modLoader}`);

    if (!modLoader) return res.status(400).json({ error: 'Falta modLoader' });

    try {
      const versions = await getMcVersions(String(modLoader));
      console.log(`[API] Devolviendo ${versions.length} versiones de MC para ${modLoader}`);
      res.json({ versions });
    } catch (err) {
      console.error(`[API] Error en /versions:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/servers/loaderVersions
  router.get('/servers/loaderVersions', async (req, res) => {
    const { modLoader, mcVersion } = req.query;
    console.log(`[API] GET /servers/loaderVersions?modLoader=${modLoader}&mcVersion=${mcVersion}`);

    if (!modLoader || !mcVersion) return res.status(400).json({ error: 'Faltan parámetros' });

    try {
      const versions = await getLoaderVersions(String(modLoader), String(mcVersion));
      console.log(`[API] Devolviendo ${versions.length} versiones de ${modLoader} para MC ${mcVersion}`);
      res.json({ versions });
    } catch (err) {
      console.error(`[API] Error en /loaderVersions:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/servers/create
  router.post('/servers/create', async (req, res) => {
    const { name, version, modLoader, loaderVersion, ram, jvmArgs } = req.body;

    // Validaciones
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre del servidor no puede estar vacío' });
    if (!version) return res.status(400).json({ error: 'La versión es requerida' });
    if (!modLoader) return res.status(400).json({ error: 'El modloader es requerido' });
    if (!ram || isNaN(ram) || ram < 256) return res.status(400).json({ error: 'RAM debe ser mayor a 256 MB' });
    if (modLoader !== 'vanilla' && !loaderVersion) return res.status(400).json({ error: 'La versión del modloader es requerida' });

    const serverName = name.trim();
    const serverDir = path.join(getServerRoot(), serverName);

    // Verificar si ya existe
    if (fs.existsSync(serverDir)) {
      return res.status(409).json({ error: `Ya existe un servidor con el nombre "${serverName}"` });
    }

    try {
      // Crear directorio
      await fs.promises.mkdir(serverDir, { recursive: true });

      // Crear eula.txt
      await fs.promises.writeFile(
        path.join(serverDir, 'eula.txt'),
        '#By changing the setting below to true you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\r\n' +
        '#Server startup will fail if eula.txt does not exist or if this setting remains false.\r\n' +
        `#${new Date().toISOString()}\r\n` +
        'eula=true\r\n',
        'utf-8'
      );

      // Crear server.properties
      const maxPlayers = 20;
      const serverProps = [
        '#Minecraft server properties',
        `#${new Date().toISOString()}`,
        'accepts-transfers=false',
        'allow-flight=false',
        'allow-nether=true',
        'broadcast-console-to-ops=true',
        'broadcast-rcon-to-ops=true',
        'bug-report-link=',
        'difficulty=easy',
        'enable-command-block=false',
        'enable-jmx-monitoring=false',
        'enable-query=false',
        'enable-rcon=false',
        'enable-status=true',
        'enforce-secure-profile=true',
        'enforce-whitelist=false',
        'entity-broadcast-range-percentage=100',
        'force-gamemode=false',
        'function-permission-level=2',
        'gamemode=survival',
        'generate-structures=true',
        'generator-settings={}',
        'hardcore=false',
        'hide-online-players=false',
        'initial-disabled-packs=',
        'initial-enabled-packs=vanilla',
        'level-name=world',
        'level-seed=',
        `level-type=minecraft:${modLoader === 'vanilla' ? 'normal' : 'normal'}`,
        'log-ips=true',
        'max-chained-neighbor-updates=1000000',
        `max-players=${maxPlayers}`,
        'max-tick-time=60000',
        'max-world-size=29999984',
        'motd=§6CW-MC§r §e Servidor Personalizado',
        'network-compression-threshold=256',
        'online-mode=true',
        'op-permission-level=4',
        'player-idle-timeout=0',
        'prevent-proxy-connections=false',
        'pvp=true',
        'query.port=25565',
        'rate-limit=0',
        'rcon.password=',
        'rcon.port=25575',
        'region-file-compression=deflate',
        'require-resource-pack=false',
        'resource-pack=',
        'resource-pack-id=',
        'resource-pack-prompt=',
        'server-ip=0.0.0.0',
        'server-port=25565',
        'simulate-player-count=false',
        'spawn-animals=true',
        'spawn-monsters=true',
        'spawn-npcs=true',
        'spawn-protection=16',
        'text-filtering-config=',
        'use-native-transport=true',
        'view-distance=10',
        'white-list=false',
      ];

      await fs.promises.writeFile(
        path.join(serverDir, 'server.properties'),
        serverProps.join('\r\n') + '\r\n',
        'utf-8'
      );

      // Crear cw-mc-config.json
      const cwConfig = {
        version,
        modLoader,
        loaderVersion: modLoader === 'vanilla' ? undefined : loaderVersion,
        ram,
        jvmArgs: jvmArgs || '',
        serverJar: 'server.jar',
      };
      await fs.promises.writeFile(
        path.join(serverDir, 'cw-mc-config.json'),
        JSON.stringify(cwConfig, null, 2),
        'utf-8'
      );

      // Descargar server.jar
      const jarPath = path.join(serverDir, 'server.jar');
      try {
        await downloadServerJar(version, modLoader, jarPath, loaderVersion, serverDir);
      } catch (jarErr) {
        // Si no se puede descargar, crear un archivo stub
        console.warn(`Error descargando server.jar: ${jarErr.message}`);
        const stubMsg = `ADVERTENCIA: No se pudo descargar automaticamente la JAR para ${modLoader} ${version}.\n\nInstrucciones:\n${jarErr.message}\n\nDescargá y colocá el archivo como 'server.jar' en este directorio.`;
        await fs.promises.writeFile(jarPath, '', 'utf-8');
        await fs.promises.writeFile(
          path.join(serverDir, 'JAR_DOWNLOAD_ERROR.txt'),
          stubMsg,
          'utf-8'
        );
      }

      // Crear scripts de inicio
      const javaVer = getMcJavaVersion(version);
      const javaD = isJavaReady(javaVer) ? getJavaDir(javaVer) : null;
      const javaNote = javaD
        ? `Java ${javaVer} gestionado: ${javaD}`
        : `Java ${javaVer} requerido`;

      const xmx = `-Xmx${ram / 1024}G`;
      const xms = `-Xms${Math.max(256, ram / 4)}M`;
      const jvmArgsStr = jvmArgs ? ` ${jvmArgs}` : '';

      // ── Windows .bat
      const batContent = [
        '@echo off',
        `REM Generado por CW-MC — ${javaNote}`,
        `REM ${modLoader.toUpperCase()} ${version}`,
        '',
        javaD ? `SET "JAVA_HOME=${javaD}"` : 'REM Java gestionado no disponible, usando java del PATH',
        javaD ? 'SET "PATH=%JAVA_HOME%\\bin;%PATH%"' : '',
        '',
        `java ${xmx} ${xms} ${jvmArgsStr}-jar server.jar nogui`,
        'pause',
      ].filter(l => l !== undefined).join('\r\n');

      await fs.promises.writeFile(path.join(serverDir, 'start-server.bat'), batContent, 'utf-8');

      // ── Linux / macOS .sh
      const shContent = [
        '#!/usr/bin/env bash',
        `# Generado por CW-MC — ${javaNote}`,
        `# ${modLoader.toUpperCase()} ${version}`,
        '',
        javaD ? `export JAVA_HOME="${javaD}"` : '# Java gestionado no disponible, usando java del PATH',
        javaD ? 'export PATH="$JAVA_HOME/bin:$PATH"' : '',
        '',
        `java ${xmx} ${xms} ${jvmArgsStr}-jar server.jar nogui`,
      ].filter(l => l !== undefined).join('\n');

      await fs.promises.writeFile(path.join(serverDir, 'start-server.sh'), shContent, 'utf-8');
      if (!isWindows) {
        try { fs.chmodSync(path.join(serverDir, 'start-server.sh'), 0o755); } catch { /* ignorar */ }
      }

      // Crear directorios estándar
      for (const dir of ['backups', 'world', 'logs', 'config']) {
        await fs.promises.mkdir(path.join(serverDir, dir), { recursive: true });
      }

      // Refrescar lista de servidores
      refreshServers();

      res.json({ ok: true, serverName });
    } catch (err) {
      console.error('Error creando servidor:', err);
      // Limpiar directorio si algo falló
      try { await fs.promises.rm(serverDir, { recursive: true, force: true }); } catch { /* ignorar */ }
      res.status(500).json({ error: err.message || 'Error al crear el servidor' });
    }
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
