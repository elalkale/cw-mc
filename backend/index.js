// backend/index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
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

// --- Sesiones ---
const sessionMiddleware = session({
  secret: 'clave-super-secreta',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false },
});
app.use(sessionMiddleware);

// --- Usuarios de ejemplo ---
const users = [
  { id: 1, username: 'admin', password: '1234' }
];

function requireLogin(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'No autenticado' });
}

// --- Login / Logout ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
  req.session.userId = user.id;
  res.json({ ok: true });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});


// --- Detectar servidores automáticamente ---
const SERVER_ROOT = path.resolve(__dirname, '..', 'servers');
const servers = {};

// Función para refrescar servidores en memoria
function refreshServers() {
  const folders = fs.readdirSync(SERVER_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  folders.forEach((folder) => {
    if (!servers[folder]) {
      servers[folder] = {
        cfg: {
          name: folder,
          dir: path.join(SERVER_ROOT, folder),
          startCmd: 'start.bat',
          host: 'localhost',
          port: 25565 + Object.keys(servers).length, // asigna puerto incremental
        },
        process: null,
        logs: '',
        commandQueue: []
      };
      console.log(`Servidor nuevo detectado automáticamente: ${folder}`);
    }
  });
}

// --- Helper ping Minecraft ---
async function checkMinecraft(cfg) {
  try {
    const s = await mcStatus(cfg.host, cfg.port, { timeout: 2000 });
    return { up: true, players: s.players?.online ?? null, motd: s.motd?.clean ?? null };
  } catch {
    return { up: false };
  }
}

// --- Endpoints API ---
const apiRouter = express.Router();
apiRouter.use(requireLogin);

apiRouter.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = users.find(u => u.id === req.session.userId);
  res.json({ loggedIn: true, username: user?.username });
});

apiRouter.get('/status', async (req, res) => {
  refreshServers();
  const result = {};
  for (const [name, state] of Object.entries(servers)) {
    const running = state.process && !state.process.killed;
    const ping = await checkMinecraft(state.cfg).catch(() => ({ up: false }));
    result[name] = { running: !!running, pid: running ? state.process.pid : null, ping };
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

app.use('/api', apiRouter);

// --- Servir frontend ---
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

// --- Socket.IO ---
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET','POST'], credentials: true }
});

// Integrar sesiones en sockets
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

io.on('connection', socket => {
  const reqSession = socket.request.session;
  if (!reqSession?.userId) return socket.disconnect();

  console.log('Socket conectado', socket.id);

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
