import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { status as mcStatus } from 'minecraft-server-util';
import dotenv from 'dotenv';
import archiver from 'archiver';
import multer from 'multer';
import os from 'os';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import unzipper from 'unzipper';
import crypto from 'crypto';

// --- __dirname en ESM (antes de dotenv para poder calcular la ruta del .env) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Siempre carga el .env desde la raíz del proyecto, sin importar desde dónde se ejecute el proceso
dotenv.config({ path: path.join(__dirname, '../.env') });

// --- Express ---
const app = express();
app.use(express.json({ limit: '50mb' }));

// --- CORS ---
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// --- JWT Secret ---
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// --- Config persistente ---
const configPath = path.join(__dirname, 'config.json');

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    const defaultConfig = { serverRoot: path.join(__dirname, '../', 'servers') };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function saveConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

// SERVER_ROOT es mutable para que el endpoint de settings pueda actualizarlo en caliente
let SERVER_ROOT = path.resolve(loadConfig().serverRoot);

// --- Upload temporal ---
const upload = multer({ dest: os.tmpdir() });

// --- Token verification middleware ---
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido', loggedIn: false });
    req.user = user;
    next();
  });
}

// --- Usuario (credenciales desde .env) ---
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password';

// --- Login / Logout ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(400).json({ error: 'Usuario o contraseña incorrectos', loggedIn: false });
  }

  const token = jwt.sign({ id: 1, username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ ok: true, token, loggedIn: true });
});

app.post('/logout', (_req, res) => res.json({ ok: true }));

// --- Verificar sesión actual ---
app.get('/api/me', verifyToken, (req, res) => {
  res.json({ loggedIn: true, user: req.user });
});

// --- Icono público (sin auth, directo al filesystem) ---
app.get('/api/server-icon/:name', (req, res) => {
  const iconPath = path.join(SERVER_ROOT, req.params.name, 'server-icon.png');
  if (!fs.existsSync(iconPath)) {
    return res.status(404).json({ error: 'Icono no encontrado' });
  }
  res.sendFile(iconPath);
});

// --- Servidores en memoria ---
const servers = {};

function getServerVersion(dir) {
  try {
    const jar = fs.readdirSync(dir).find(f => f.endsWith('.jar'));
    if (jar) {
      const match = jar.match(/(\d+\.\d+(\.\d+)?)/);
      return match ? match[1] : jar;
    }
  } catch {
    // directorio inaccesible — devolvemos desconocida
  }
  return 'Desconocida';
}

function getServerPort(dir) {
  try {
    const propsPath = path.join(dir, 'server.properties');
    if (fs.existsSync(propsPath)) {
      const content = fs.readFileSync(propsPath, 'utf-8');
      const match = content.match(/^server-port\s*=\s*(\d+)/m);
      if (match) return parseInt(match[1], 10);
    }
  } catch { /* ignore */ }
  return 25565;
}

function refreshServers() {
  // Crear el directorio si no existe todavía
  if (!fs.existsSync(SERVER_ROOT)) {
    fs.mkdirSync(SERVER_ROOT, { recursive: true });
    console.log(`Directorio de servidores creado: ${SERVER_ROOT}`);
    return;
  }

  const folders = new Set(
    fs.readdirSync(SERVER_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  );

  // Eliminar servidores cuya carpeta ya no existe (y no están corriendo)
  for (const name of Object.keys(servers)) {
    if (!folders.has(name)) {
      const state = servers[name];
      if (!state.process || state.process.killed) {
        delete servers[name];
        console.log(`Servidor eliminado de la lista: ${name}`);
      }
    }
  }

  // Añadir nuevos servidores detectados
  for (const folder of folders) {
    if (!servers[folder]) {
      const dir = path.join(SERVER_ROOT, folder);
      const modpackPath = path.join(dir, 'cw-mc-modpack.json');
      let modpack = null;
      if (fs.existsSync(modpackPath)) {
        try { modpack = JSON.parse(fs.readFileSync(modpackPath, 'utf-8')); } catch { /* ignorar */ }
      }
      servers[folder] = {
        cfg: {
          name: folder,
          dir,
          startCmd: 'start.bat',
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
    }
  }
}

// Cargar servidores al arrancar
refreshServers();

// --- Helper ping Minecraft ---
async function checkMinecraft(cfg) {
  try {
    const s = await mcStatus(cfg.host, cfg.port, { timeout: 2000 });
    return {
      up: true,
      players: {
        online: s.players?.online ?? 0,
        max: s.players?.max ?? 0,
        sample: s.players?.sample ?? [],
      },
      motd: s.motd?.clean ?? null,
    };
  } catch {
    return { up: false, players: { online: 0, max: 0, sample: [] } };
  }
}

// --- Función auxiliar: resolver y validar ruta dentro de un servidor ---
function resolveSafePath(serverDir, relativePath) {
  const target = path.join(serverDir, relativePath);
  if (!target.startsWith(serverDir)) return null;
  return target;
}

// --- API Router (todas las rutas bajo /api requieren token) ---
const apiRouter = express.Router();
apiRouter.use(verifyToken);

// Settings
apiRouter.get('/settings', (_req, res) => {
  res.json({ serverRoot: loadConfig().serverRoot });
});

apiRouter.post('/settings', (req, res) => {
  const { serverRoot } = req.body;
  if (!serverRoot) {
    return res.status(400).json({ error: 'No se proporcionaron configuraciones válidas' });
  }

  const resolved = path.resolve(serverRoot);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return res.status(400).json({ error: 'La ruta proporcionada no es un directorio válido' });
  }

  SERVER_ROOT = resolved;
  const cfg = loadConfig();
  cfg.serverRoot = resolved;
  saveConfig(cfg);
  refreshServers();

  res.json({ ok: true, message: 'Ruta de servidores actualizada' });
});

// Status
apiRouter.get('/status', async (req, res) => {
  refreshServers();
  const result = {};

  for (const [name, state] of Object.entries(servers)) {
    const running = state.process && !state.process.killed;
    // Solo hacer ping si el proceso está activo — evita falsos positivos cuando
    // varios servidores comparten el puerto por defecto 25565
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

// Start
apiRouter.post('/start', (req, res) => {
  refreshServers();
  const { name } = req.body;
  const state = servers[name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  if (state.process && !state.process.killed) return res.status(400).json({ error: 'Ya en ejecución' });

  const child = spawn(state.cfg.startCmd, [], { cwd: state.cfg.dir, shell: true });
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

// Stop
apiRouter.post('/stop', (req, res) => {
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
    // Sin stdin disponible → forzar kill directamente
    const killer = spawn('taskkill', ['/PID', String(state.process.pid), '/T', '/F']);
    killer.on('close', () => res.json({ ok: true, method: 'taskkill' }));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Force-stop: mata el proceso inmediatamente sin esperar al guardado
apiRouter.post('/force-stop', (req, res) => {
  refreshServers();
  const { name } = req.body;
  const state = servers[name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  if (!state.process || state.process.killed) return res.status(400).json({ error: 'No en ejecución' });

  try {
    const killer = spawn('taskkill', ['/PID', String(state.process.pid), '/T', '/F']);
    killer.on('close', () => res.json({ ok: true, method: 'taskkill' }));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Logs (vía HTTP, para carga inicial si el socket no está disponible)
apiRouter.get('/logs/:name', (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  res.send(state.logs);
});

// Command
apiRouter.post('/command', (req, res) => {
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

// ── Archivos ─────────────────────────────────────────────────────────────────

apiRouter.get('/files/:name', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const relativePath = req.query.path || '/';
  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const items = await fs.promises.readdir(targetPath, { withFileTypes: true });
    const result = items
      .map(item => ({ name: item.name, isDirectory: item.isDirectory() }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    res.json({ ok: true, currentPath: relativePath, items: result });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'La ruta no existe' });
    if (err.code === 'ENOTDIR') return res.status(400).json({ error: 'La ruta no es una carpeta' });
    res.status(500).json({ error: 'Error interno al leer los archivos' });
  }
});

apiRouter.get('/files/:name/content', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  if (!relativePath) return res.status(400).json({ error: 'Falta el parámetro path' });

  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const stats = await fs.promises.stat(targetPath);
    if (stats.isDirectory()) return res.status(400).json({ error: 'La ruta es una carpeta' });

    const ext = path.extname(targetPath).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
      res.sendFile(targetPath);
    } else {
      const content = await fs.promises.readFile(targetPath, 'utf8');
      res.json({ ok: true, content });
    }
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'El archivo no existe' });
    res.status(500).json({ error: 'Error interno al leer el archivo' });
  }
});

apiRouter.put('/files/:name/content', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  const { content, isBase64 } = req.body;

  if (!relativePath) return res.status(400).json({ error: 'Falta el parámetro path' });
  if (content === undefined) return res.status(400).json({ error: 'Falta el contenido' });

  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    if (fs.existsSync(targetPath) && (await fs.promises.stat(targetPath)).isDirectory()) {
      return res.status(400).json({ error: 'No se puede sobrescribir una carpeta' });
    }

    if (isBase64) {
      const base64 = content.split(',')[1] || content;
      await fs.promises.writeFile(targetPath, Buffer.from(base64, 'base64'));
    } else {
      await fs.promises.writeFile(targetPath, content, 'utf8');
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error guardando archivo:', err);
    res.status(500).json({ error: 'Error interno al guardar el archivo' });
  }
});

apiRouter.delete('/files/:name/content', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  if (!relativePath) return res.status(400).json({ error: 'Falta el parámetro path' });

  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath || targetPath === state.cfg.dir) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    await fs.promises.rm(targetPath, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'El archivo no existe' });
    res.status(500).json({ error: 'Error interno al borrar' });
  }
});

apiRouter.post('/files/:name/folder', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  const { folderName } = req.body;
  if (!relativePath || !folderName) return res.status(400).json({ error: 'Faltan parámetros' });

  const targetPath = resolveSafePath(state.cfg.dir, path.join(relativePath, folderName));
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    await fs.promises.mkdir(targetPath);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'EEXIST') return res.status(400).json({ error: 'La carpeta ya existe' });
    res.status(500).json({ error: 'Error interno al crear la carpeta' });
  }
});

apiRouter.post('/files/:name/file', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  const { fileName } = req.body;
  if (!relativePath || !fileName) return res.status(400).json({ error: 'Faltan parámetros' });

  const targetPath = resolveSafePath(state.cfg.dir, path.join(relativePath, fileName));
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  if (fs.existsSync(targetPath)) return res.status(400).json({ error: 'El archivo ya existe' });

  try {
    await fs.promises.writeFile(targetPath, '', 'utf8');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error interno al crear el archivo' });
  }
});

apiRouter.post('/files/:name/upload', upload.single('file'), async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

  const relativePath = req.query.path || '/';
  const targetPath = resolveSafePath(state.cfg.dir, path.join(relativePath, req.file.originalname));

  if (!targetPath) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    await fs.promises.copyFile(req.file.path, targetPath);
    await fs.promises.unlink(req.file.path);
    res.json({ ok: true });
  } catch (err) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    console.error('Error subiendo archivo:', err);
    res.status(500).json({ error: 'Error interno al procesar el archivo' });
  }
});

apiRouter.get('/files/:name/download', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const relativePath = req.query.path || '/';
  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const stats = await fs.promises.stat(targetPath);
    if (stats.isDirectory()) return res.status(400).json({ error: 'La ruta es una carpeta' });
    res.download(targetPath, path.basename(targetPath));
  } catch {
    res.status(500).json({ error: 'Error interno al descargar el archivo' });
  }
});

// ── Backups ───────────────────────────────────────────────────────────────────

apiRouter.get('/backup/:name', async (req, res) => {
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

apiRouter.post('/backup/:name/local', async (req, res) => {
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

// ── CurseForge proxy ──────────────────────────────────────────────────────────
// El API key queda en el backend y nunca se expone al cliente.

const CF_BASE = 'https://api.curseforge.com/v1';

function cfHeaders() {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-api-key': process.env.CURSEFORGE_API_TOKEN || '',
  };
}

// ── CurseForge fingerprint (MurmurHash2 32-bit, seed=1, sin espacios) ─────────
function murmur2_32(buf, seed) {
  const M = 0x5bd1e995;
  let h = (seed ^ buf.length) >>> 0;
  let i = 0;
  while (i + 4 <= buf.length) {
    let k = ((buf[i + 3] << 24) | (buf[i + 2] << 16) | (buf[i + 1] << 8) | buf[i]) >>> 0;
    k = Math.imul(k, M) >>> 0; k ^= k >>> 24; k = Math.imul(k, M) >>> 0;
    h = Math.imul(h, M) >>> 0; h = (h ^ k) >>> 0;
    i += 4;
  }
  switch (buf.length - i) {
    case 3: h = (h ^ (buf[i + 2] << 16)) >>> 0; // fallthrough
    case 2: h = (h ^ (buf[i + 1] << 8)) >>> 0;  // fallthrough
    case 1: h = (h ^ buf[i]) >>> 0; h = Math.imul(h, M) >>> 0;
  }
  h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, M) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return h >>> 0;
}

function cfFingerprint(fileBuffer) {
  let count = 0;
  for (let i = 0; i < fileBuffer.length; i++) {
    const b = fileBuffer[i];
    if (b !== 9 && b !== 10 && b !== 13 && b !== 32) count++;
  }
  const filtered = Buffer.allocUnsafe(count);
  let j = 0;
  for (let i = 0; i < fileBuffer.length; i++) {
    const b = fileBuffer[i];
    if (b !== 9 && b !== 10 && b !== 13 && b !== 32) filtered[j++] = b;
  }
  return murmur2_32(filtered, 1);
}

// POST /api/curseforge/mods  { modIds: [1,2,...] }
// Devuelve datos de varios mods a la vez (para las tarjetas del catálogo)
apiRouter.post('/curseforge/mods', async (req, res) => {
  const { modIds } = req.body;
  if (!Array.isArray(modIds) || modIds.length === 0) {
    return res.status(400).json({ error: 'modIds requeridos' });
  }
  if (!process.env.CURSEFORGE_API_TOKEN) {
    return res.json({ data: [] }); // sin key → devolver vacío sin romper
  }
  try {
    const resp = await fetch(`${CF_BASE}/mods`, {
      method: 'POST',
      headers: cfHeaders(),
      body: JSON.stringify({ modIds }),
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('CurseForge batch error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

// GET /api/curseforge/mod/:modId
// Datos completos de un único mod (logo, screenshots, summary…)
apiRouter.get('/curseforge/mod/:modId', async (req, res) => {
  if (!process.env.CURSEFORGE_API_TOKEN) return res.json({ data: null });
  try {
    const resp = await fetch(`${CF_BASE}/mods/${req.params.modId}`, { headers: cfHeaders() });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('CurseForge single mod error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

// GET /api/curseforge/mod/:modId/description
// Devuelve la descripción HTML del mod
apiRouter.get('/curseforge/mod/:modId/description', async (req, res) => {
  if (!process.env.CURSEFORGE_API_TOKEN) return res.json({ data: '' });
  try {
    const resp = await fetch(`${CF_BASE}/mods/${req.params.modId}/description`, { headers: cfHeaders() });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('CurseForge description error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

// GET /api/curseforge/mod/:modId/files?index=0&pageSize=50
// Lista todos los archivos de un mod (para el historial de versiones)
apiRouter.get('/curseforge/mod/:modId/files', async (req, res) => {
  if (!process.env.CURSEFORGE_API_TOKEN) return res.json({ data: [], pagination: {} });
  try {
    const { index = 0, pageSize = 50 } = req.query;
    const resp = await fetch(
      `${CF_BASE}/mods/${req.params.modId}/files?index=${index}&pageSize=${pageSize}`,
      { headers: cfHeaders() }
    );
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('CurseForge files error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

// GET /api/curseforge/mods/search?searchFilter=...&gameVersion=...&modLoaderType=...&index=...&pageSize=...&sortField=...
// Busca mods (classId=6) en CurseForge
apiRouter.get('/curseforge/mods/search', async (req, res) => {
  if (!process.env.CURSEFORGE_API_TOKEN) return res.json({ data: [], pagination: { totalCount: 0 } });
  try {
    const params = new URLSearchParams();
    params.set('gameId', '432');
    params.set('classId', '6');
    const allowed = ['searchFilter', 'gameVersion', 'modLoaderType', 'sortField', 'sortOrder', 'index', 'pageSize', 'categoryId'];
    for (const p of allowed) {
      if (req.query[p] !== undefined && req.query[p] !== '') params.set(p, req.query[p]);
    }
    const resp = await fetch(`${CF_BASE}/mods/search?${params}`, { headers: cfHeaders() });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('CurseForge mods search error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

// GET /api/curseforge/mod/:modId/file/:fileId/download-url
// Devuelve la URL de descarga del server pack
apiRouter.get('/curseforge/mod/:modId/file/:fileId/download-url', async (req, res) => {
  if (!process.env.CURSEFORGE_API_TOKEN) return res.json({ data: null });
  try {
    const resp = await fetch(
      `${CF_BASE}/mods/${req.params.modId}/files/${req.params.fileId}/download-url`,
      { headers: cfHeaders() }
    );
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('CurseForge download-url error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

// --- Instalación de server packs ---
const installs = {}; // { [installId]: { status, error, serverName } }

async function runInstall(installId, modId, fileId, destDir, meta) {
  try {
    // 1. Obtener URL de descarga de CurseForge
    const urlResp = await fetch(
      `${CF_BASE}/mods/${modId}/files/${fileId}/download-url`,
      { headers: cfHeaders() }
    );
    const urlData = await urlResp.json();
    const downloadUrl = urlData?.data;
    if (!downloadUrl) throw new Error('No se pudo obtener la URL de descarga');

    // 2. Descargar el ZIP a un archivo temporal
    const tmpFile = path.join(os.tmpdir(), `cw-mc-install-${installId}.zip`);
    const dlResp = await fetch(downloadUrl);
    if (!dlResp.ok) throw new Error(`Error descargando: ${dlResp.status}`);

    await new Promise((resolve, reject) => {
      const dest = createWriteStream(tmpFile);
      Readable.fromWeb(dlResp.body).pipe(dest);
      dest.on('finish', resolve);
      dest.on('error', reject);
    });

    // 3. Extraer el ZIP al directorio de destino
    fs.mkdirSync(destDir, { recursive: true });
    await new Promise((resolve, reject) => {
      fs.createReadStream(tmpFile)
        .pipe(unzipper.Extract({ path: destDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    // 4. Limpiar temp
    fs.rmSync(tmpFile, { force: true });

    // 4b. Guardar metadatos del modpack
    if (meta) {
      await fs.promises.writeFile(
        path.join(destDir, 'cw-mc-modpack.json'),
        JSON.stringify(meta, null, 2),
        'utf-8'
      );
    }

    // 5. Ejecutar install.bat (Windows) o install.sh (Linux/Mac) si existe
    const batPath = path.join(destDir, 'install.bat');
    const shPath  = path.join(destDir, 'install.sh');

    if (fs.existsSync(batPath)) {
      await new Promise((resolve, reject) => {
        const proc = spawn('cmd.exe', ['/c', 'install.bat'], { cwd: destDir });
        proc.on('close', code => {
          if (code === 0) resolve();
          else reject(new Error(`install.bat terminó con código ${code}`));
        });
        proc.on('error', reject);
      });
    } else if (fs.existsSync(shPath)) {
      await new Promise((resolve, reject) => {
        const proc = spawn('bash', ['install.sh'], { cwd: destDir });
        proc.on('close', code => {
          if (code === 0) resolve();
          else reject(new Error(`install.sh terminó con código ${code}`));
        });
        proc.on('error', reject);
      });
    }

    // 6. Refrescar lista de servidores
    refreshServers();

    installs[installId].status = 'done';
  } catch (err) {
    console.error('Error instalando server pack:', err);
    installs[installId].status = 'error';
    installs[installId].error = err.message;
  }
}

// POST /api/install — inicia la instalación en background
apiRouter.post('/install', (req, res) => {
  const { modId, fileId, serverName, meta } = req.body;
  if (!modId || !fileId || !serverName) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  const destDir = path.join(SERVER_ROOT, serverName);
  if (fs.existsSync(destDir)) {
    return res.status(409).json({ error: `Ya existe un servidor con el nombre "${serverName}"` });
  }

  const installId = crypto.randomUUID();
  installs[installId] = { status: 'installing', error: null, serverName };

  runInstall(installId, modId, fileId, destDir, meta ?? null); // sin await → background

  res.json({ installId });
});

// GET /api/install/:installId — estado de una instalación
apiRouter.get('/install/:installId', (req, res) => {
  const entry = installs[req.params.installId];
  if (!entry) return res.status(404).json({ error: 'Instalación no encontrada' });
  res.json(entry);
});

// ── Gestión de servidores ─────────────────────────────────────────────────────

// DELETE /api/servers/:name — elimina la carpeta y su entrada en memoria
apiRouter.delete('/servers/:name', async (req, res) => {
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

// POST /api/servers/:name/clone — copia la carpeta con un nombre nuevo
apiRouter.post('/servers/:name/clone', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const { newName } = req.body;
  const state = servers[name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  if (state.process && !state.process.killed)
    return res.status(400).json({ error: 'Detén el servidor antes de clonarlo' });
  if (!newName || !newName.trim())
    return res.status(400).json({ error: 'El nombre del nuevo servidor no puede estar vacío' });

  const destDir = path.join(SERVER_ROOT, newName.trim());
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

// POST /api/servers/upload — extrae un ZIP como nuevo servidor
apiRouter.post('/servers/upload', upload.single('file'), async (req, res) => {
  const serverName = req.body?.serverName?.trim();
  if (!serverName) {
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'Falta el nombre del servidor' });
  }
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

  const destDir = path.join(SERVER_ROOT, serverName);
  if (fs.existsSync(destDir)) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(409).json({ error: `Ya existe un servidor con el nombre "${serverName}"` });
  }

  // Expand-Archive requiere extensión .zip — renombrar el archivo temporal
  const zipPath = req.file.path + '.zip';
  try {
    await fs.promises.rename(req.file.path, zipPath);
  } catch (err) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ error: 'No se pudo preparar el archivo ZIP' });
  }

  try {
    fs.mkdirSync(destDir, { recursive: true });

    // Expand-Archive maneja cualquier ZIP estándar de Windows sin dependencias externas
    await new Promise((resolve, reject) => {
      const ps = spawn(
        'powershell.exe',
        [
          '-NoProfile', '-NonInteractive', '-Command',
          `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`,
        ],
        { shell: false }
      );

      const errChunks = [];
      ps.stderr.on('data', (d) => errChunks.push(d));

      ps.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(errChunks.join('').trim() || `Expand-Archive salió con código ${code}`));
      });
      ps.on('error', reject);
    });

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

// GET /api/servers/:name/mods — lista los mods (.jar / .jar.disabled)
apiRouter.get('/servers/:name/mods', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const state = servers[name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  const modsDir = path.join(state.cfg.dir, 'mods');
  if (!fs.existsSync(modsDir)) return res.json({ mods: [], needsIdentification: false });
  try {
    // Leer mods.json si existe
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
            // null = aún no identificado, false = no encontrado en CF, true = reconocido
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

// POST /api/servers/:name/mods/identify — fingerprint de todos los .jar → mods.json
apiRouter.post('/servers/:name/mods/identify', async (req, res) => {
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

    // Calcular fingerprint de cada .jar
    const fpToBase = {}; // fingerprint → baseName
    for (const filename of jarFiles) {
      const baseName = filename.replace(/\.disabled$/, '');
      const buf = await fs.promises.readFile(path.join(modsDir, filename));
      fpToBase[cfFingerprint(buf)] = baseName;
    }

    if (process.env.CURSEFORGE_API_TOKEN) {
      // Consultar API de fingerprints de CurseForge
      const fpResp = await fetch(`${CF_BASE}/fingerprints/432`, {
        method: 'POST',
        headers: cfHeaders(),
        body: JSON.stringify({ fingerprints: Object.keys(fpToBase).map(Number) }),
      });
      const fpData = await fpResp.json();

      // fingerprint → { modId, fileId }
      const matchMap = {};
      for (const match of (fpData?.data?.exactMatches || [])) {
        const fp = match.file?.fileFingerprint;
        if (fp) matchMap[fp] = { modId: match.id, fileId: match.file.id, gameVersions: match.file?.gameVersions || [] };
      }

      // Obtener detalles de los mods coincidentes
      const modIds = [...new Set(Object.values(matchMap).map(m => m.modId))];
      const modInfoMap = {};
      if (modIds.length) {
        const modsResp = await fetch(`${CF_BASE}/mods`, {
          method: 'POST', headers: cfHeaders(),
          body: JSON.stringify({ modIds }),
        });
        for (const mod of ((await modsResp.json())?.data || [])) {
          modInfoMap[mod.id] = {
            cfName: mod.name,
            slug: mod.slug,
            logo: mod.logo?.thumbnailUrl || mod.logo?.url || null,
            summary: mod.summary,
            downloadCount: mod.downloadCount,
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
      // Sin token — marcar todos como no reconocidos
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

// POST /api/servers/:name/mods/toggle — activa o desactiva un mod
apiRouter.post('/servers/:name/mods/toggle', async (req, res) => {
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

// DELETE /api/servers/:name/mods/:filename — elimina un mod del servidor
apiRouter.delete('/servers/:name/mods/:filename', async (req, res) => {
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
  // Limpiar también la entrada en mods.json si existe
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

// POST /api/servers/:name/mods/install — descarga e instala un mod .jar desde CurseForge
// - Elimina versiones anteriores del mismo modId (sin duplicados)
// - Instala dependencias requeridas automáticamente (relationType === 3)
apiRouter.post('/servers/:name/mods/install', async (req, res) => {
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

  // Descarga un archivo de CurseForge, elimina versiones antiguas del mismo modId
  const downloadMod = async (mId, fId) => {
    // Eliminar versión anterior del mismo modId
    // Busca en mods.json por modId y elimina ambas variantes (.jar y .jar.disabled)
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
    // 1. Detalles del archivo principal (gameVersions + dependencias)
    const fileDetailsResp = await fetch(`${CF_BASE}/mods/${modId}/files/${fileId}`, { headers: cfHeaders() });
    const fileDetails = (await fileDetailsResp.json())?.data || {};
    const gameVersions = fileDetails.gameVersions || [];
    const mcVersion = gameVersions.find(v => /^\d+\.\d+/.test(v)) || '';
    const loaderName = gameVersions.find(v => ['Forge', 'Fabric', 'Quilt', 'NeoForge'].includes(v));
    const loaderTypeMap = { Forge: 1, Fabric: 4, Quilt: 5, NeoForge: 6 };
    const loaderType = loaderTypeMap[loaderName] || 0;

    // 2. Instalar mod principal
    const filename = await downloadMod(modId, fileId);

    // 3. Actualizar mods.json para el mod principal
    const modResp = await fetch(`${CF_BASE}/mods/${modId}`, { headers: cfHeaders() }).catch(() => null);
    const mod = modResp ? (await modResp.json())?.data : null;
    modsJson.mods[filename] = {
      recognized: true, modId: Number(modId), fileId: Number(fileId), gameVersions,
      cfName: mod?.name || null, slug: mod?.slug || null,
      logo: mod?.logo?.thumbnailUrl || mod?.logo?.url || null,
      summary: mod?.summary || null, downloadCount: mod?.downloadCount || null,
    };

    // 4. Instalar dependencias requeridas
    const deps = [];
    const failedDeps = [];
    const requiredDeps = (fileDetails.dependencies || []).filter(d => d.relationType === 3);

    for (const dep of requiredDeps) {
      // Saltar si ya está instalado
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

// POST /api/servers/:name/mods/upload — sube uno o más mods (.jar)
apiRouter.post('/servers/:name/mods/upload', upload.array('mods', 20), async (req, res) => {
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
  // Invalidar mods.json para re-identificar en la próxima carga
  if (uploaded.length) {
    await fs.promises.unlink(path.join(state.cfg.dir, 'mods.json')).catch(() => {});
  }

  res.json({ ok: true, uploaded, errors });
});

app.use('/api', apiRouter);

// --- Servir frontend en producción ---
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

// --- Socket.IO ---
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'], credentials: true },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Token no proporcionado'));

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Token inválido'));
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  });
});

io.on('connection', socket => {
  console.log(`Socket conectado: ${socket.id} (${socket.username})`);

  socket.on('join', (serverName) => {
    const state = servers[serverName];
    if (!state) return socket.emit('error_msg', `Servidor desconocido: ${serverName}`);
    socket.join(serverName);
    socket.emit('log_history', { server: serverName, logs: state.logs });
  });

  socket.on('command', ({ server: serverName, command }) => {
    const state = servers[serverName];
    if (!state) return socket.emit('cmd_error', { server: serverName, error: 'Servidor desconocido' });

    if (!state.process || state.process.killed) {
      state.commandQueue.push(command);
      return socket.emit('cmd_queued', { server: serverName, command });
    }

    if (state.process.stdin) {
      state.process.stdin.write(command + '\n');
      socket.emit('cmd_sent', { server: serverName, command });
    } else {
      state.commandQueue.push(command);
      socket.emit('cmd_queued', { server: serverName, command });
    }
  });
});

// --- Graceful shutdown: mata todos los procesos Minecraft antes de salir ---
function shutdown(signal) {
  console.log(`\n[${signal}] Apagando backend...`);

  const running = Object.values(servers).filter(s => s.process && !s.process.killed);

  if (running.length === 0) {
    process.exit(0);
  }

  let pending = running.length;
  const done = () => { if (--pending === 0) process.exit(0); };

  for (const state of running) {
    try {
      // taskkill /T mata todo el árbol (cmd.exe + java)
      const killer = spawn('taskkill', ['/PID', String(state.process.pid), '/T', '/F'], { shell: false });
      killer.on('close', done);
      killer.on('error', done); // si falla el taskkill igual salimos
    } catch {
      done();
    }
  }

  // Salida forzada tras 8 s por si algún proceso no responde
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// --- Iniciar ---
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Backend escuchando en http://localhost:${PORT}`));
