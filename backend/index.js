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
  }

  const folders = fs.readdirSync(SERVER_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const folder of folders) {
    if (!servers[folder]) {
      const dir = path.join(SERVER_ROOT, folder);
      servers[folder] = {
        cfg: {
          name: folder,
          dir,
          startCmd: 'start.bat',
          host: 'localhost',
          port: getServerPort(dir),
          version: getServerVersion(dir),
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

async function runInstall(installId, modId, fileId, destDir) {
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
  const { modId, fileId, serverName } = req.body;
  if (!modId || !fileId || !serverName) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  const destDir = path.join(SERVER_ROOT, serverName);
  if (fs.existsSync(destDir)) {
    return res.status(409).json({ error: `Ya existe un servidor con el nombre "${serverName}"` });
  }

  const installId = crypto.randomUUID();
  installs[installId] = { status: 'installing', error: null, serverName };

  runInstall(installId, modId, fileId, destDir); // sin await → background

  res.json({ installId });
});

// GET /api/install/:installId — estado de una instalación
apiRouter.get('/install/:installId', (req, res) => {
  const entry = installs[req.params.installId];
  if (!entry) return res.status(404).json({ error: 'Instalación no encontrada' });
  res.json(entry);
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

// --- Iniciar ---
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Backend escuchando en http://localhost:${PORT}`));
