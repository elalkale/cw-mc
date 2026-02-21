// backend/index.js
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

// --- __dirname en ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Express ---
const app = express();
app.use(express.json());

// --- CORS ---
const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
};
app.use(cors(corsOptions));

// --- JWT Secret ---
const JWT_SECRET = 'tu-clave-secreta-super-segura-cambiar-en-produccion';

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

// --- Usuarios de ejemplo ---
const users = [
  { id: 1, username: 'admin', password: '1234' }
];

// --- Login / Logout ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(400).json({ error: 'Usuario o contraseña incorrectos', loggedIn: false });
  }

  // Generar JWT token
  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ ok: true, token, loggedIn: true });
});

app.post('/logout', (req, res) => {
  // El logout es solo del lado del cliente eliminando el token de localStorage
  res.json({ ok: true });
});

// --- Verificar sesión actual ---
app.get('/api/me', verifyToken, (req, res) => {
  res.json({ loggedIn: true, user: req.user });
});

// --- Endpoint público para servir iconos (sin autenticación) ---
app.get('/api/server-icon/:name', (req, res) => {
  refreshServers();
  const { name } = req.params;
  const iconPath = path.join(SERVER_ROOT, name, 'server-icon.png');

  if (!fs.existsSync(iconPath)) {
    return res.status(404).json({ error: 'Icono no encontrado' });
  }

  res.sendFile(iconPath);
});

// --- Detectar servidores automáticamente ---
const SERVER_ROOT = path.resolve(__dirname, '..', 'servers');
const servers = {};

// --- Detectar versión del servidor --- //
function getServerVersion(dir) {
  try {
    const files = fs.readdirSync(dir);
    const jar = files.find(f => f.endsWith('.jar'));
    if (jar) {
      const match = jar.match(/(\d+\.\d+(\.\d+)?)/);
      if (match) return match[1];
      return jar;
    }
  } catch (err) {
    console.error('Error leyendo versión en', dir, err);
  }
  return 'Desconocida';
}

// Función para refrescar servidores en memoria
function refreshServers() {
  const folders = fs.readdirSync(SERVER_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  folders.forEach((folder) => {
    if (!servers[folder]) {
      const dir = path.join(SERVER_ROOT, folder);
      servers[folder] = {
        cfg: {
          name: folder,
          dir,
          startCmd: 'start.bat',
          host: 'localhost',
          port: 25565 + Object.keys(servers).length,
          version: getServerVersion(dir),
        },
        process: null,
        logs: '',
        commandQueue: []
      };
      console.log(
        `Servidor nuevo detectado automáticamente: ${folder} (versión: ${servers[folder].cfg.version})`
      );
    }
  });
}

// --- Helper ping Minecraft ---
async function checkMinecraft(cfg) {
  try {
    const s = await mcStatus(cfg.host, cfg.port, { timeout: 2000 });
    return {
      up: true,
      players: {
        online: s.players?.online ?? 0,
        max: s.players?.max ?? 0,
        sample: s.players?.sample ?? [] // 👈 añadimos lista de jugadores
      },
      motd: s.motd?.clean ?? null
    };
  } catch {
    return { up: false, players: { online: 0, max: 0, sample: [] } };
  }
}

// --- Endpoints API ---
const apiRouter = express.Router();
apiRouter.use(verifyToken);

apiRouter.get('/status', async (req, res) => {
  refreshServers();
  const result = {};
  for (const [name, state] of Object.entries(servers)) {
    const running = state.process && !state.process.killed;
    const ping = await checkMinecraft(state.cfg).catch(() => ({ up: false }));

    const iconPath = path.join(state.cfg.dir, 'server-icon.png');
    const iconUrl = fs.existsSync(iconPath)
      ? `/api/server-icon/${encodeURIComponent(name)}`
      : null;

    result[name] = {
      running: !!running,
      pid: running ? state.process.pid : null,
      ping,
      icon: iconUrl,
      version: state.cfg.version,
      players: ping.players // 👈 aquí devolvemos players completos
    };
  }
  res.json(result);
});


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

  child.stdout.on('data', chunk => {
    const s = chunk.toString();
    state.logs += s;
    io.to(name).emit('log', { server: name, line: s });
  });
  child.stderr.on('data', chunk => {
    const s = chunk.toString();
    state.logs += s;
    io.to(name).emit('log', { server: name, line: s });
  });
  child.on('exit', (code, signal) => {
    const msg = `\n[process exited code=${code} signal=${signal}]\n`;
    state.logs += msg;
    io.to(name).emit('log', { server: name, line: msg });
    state.process = null;
  });

  if (child.stdin) state.commandQueue.forEach(cmd => child.stdin.write(cmd + '\n'));
  state.commandQueue = [];

  res.json({ ok: true, pid: child.pid });
});

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
    const pid = state.process.pid;
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
    killer.on('close', () => res.json({ ok: true, method: 'taskkill' }));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.get('/logs/:name', (req, res) => {
  refreshServers();
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  res.send(state.logs);
});

apiRouter.post('/command', (req, res) => {
  refreshServers();
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

apiRouter.get('/files/:name/content', async (req, res) => {
  refreshServers();
  const { name } = req.params;
  const state = servers[name];

  if (!state) {
    return res.status(404).json({ error: 'Servidor no encontrado' });
  }

  const relativePath = req.query.path;
  if (!relativePath) {
    return res.status(400).json({ error: 'Falta proveer el parámetro path' });
  }

  const targetPath = path.join(state.cfg.dir, relativePath);

  // Verificamos protección Anti-Path Traversal
  if (!targetPath.startsWith(state.cfg.dir)) {
    return res.status(403).json({ error: 'Acceso denegado a esta ruta' });
  }

  try {
    // Para asegurarnos de que no crasheamos si envían leer una carpeta como archivo
    const stats = await fs.promises.stat(targetPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Esta ruta es una carpeta, no un archivo' });
    }

    // Leemos el archivo en formato texto (utf8)
    const content = await fs.promises.readFile(targetPath, 'utf8');
    res.json({ ok: true, content });
  } catch (error) {
    console.error('Error leyendo archivo:', error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'El archivo no existe' });
    }
    res.status(500).json({ error: 'Error interno al leer el archivo' });
  }
});

apiRouter.get('/files/:name', async (req, res) => {
  refreshServers();
  const { name } = req.params;
  const state = servers[name];

  if (!state) {
    return res.status(404).json({ error: 'Servidor no encontrado' });
  }

  // Obtenemos el path local dentro del servidor, por defecto '/'
  const relativePath = req.query.path || '/';

  // Construimos la ruta segura para evitar ataques de transversión de directorios (path traversal)
  // ej: path.join elimina los "../" peligrosos si intentan salir del servidor
  // En windows y linux esto funciona un poco distinto, resolve lo asegura.
  const targetPath = path.join(state.cfg.dir, relativePath);

  // Verificamos que al final la ruta a la que se accede sigue dentro de la carpeta del servidor
  if (!targetPath.startsWith(state.cfg.dir)) {
    return res.status(403).json({ error: 'Acceso denegado a esta ruta' });
  }

  try {
    // Leemos el directorio con la versión de promesas de fs
    // { withFileTypes: true } hace que nos devuelva objetos donde podemos ver si es archivo o carpeta
    const items = await fs.promises.readdir(targetPath, { withFileTypes: true });

    // Mapeamos los datos para enviarlos limpios al cliente
    const resultItems = items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
    }));

    // Ordenamos la lista: primero carpetas, luego archivos alfabéticamente
    resultItems.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });

    res.json({ ok: true, currentPath: relativePath, items: resultItems });
  } catch (error) {
    console.error('Error leyendo archivos:', error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'La ruta no existe' });
    } else if (error.code === 'ENOTDIR') {
      return res.status(400).json({ error: 'La ruta especificada no es una carpeta' });
    }
    res.status(500).json({ error: 'Error interno al leer los archivos' });
  }
});

app.use('/api', apiRouter);

// --- Servir frontend ---
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

// Socket.IO
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'], credentials: true }
});

// Validar JWT en Socket.IO
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
  console.log('Socket conectado:', socket.id, 'Usuario:', socket.username);

  socket.on('join', (serverName) => {
    refreshServers();
    const state = servers[serverName];
    if (!state) return socket.emit('error_msg', `Servidor desconocido: ${serverName}`);
    socket.join(serverName);
    socket.emit('log_history', { server: serverName, logs: state.logs });
  });

  socket.on('command', ({ server: serverName, command }) => {
    refreshServers();
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

// --- Iniciar servidor ---
const PORT = 4000;
httpServer.listen(PORT, () => console.log(`Servidor backend escuchando en http://localhost:${PORT}`));
