// backend/index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const { Server } = require('socket.io');
const { status: mcStatus } = require('minecraft-server-util'); // opcional

const app = express();
app.use(bodyParser.json());
app.use(cors()); // si sirves frontend desde el mismo host, puedes ajustar origen

// --- Configura tus servidores aquí ---
const SERVER_ROOT = path.resolve(__dirname, '..', 'servers');
const CONFIG = {
  server1: { name: 'servervanilla', dir: path.join(SERVER_ROOT, 'servervanilla'), startCmd: 'start.bat', host: 'localhost', port: 25565 },
  // Añade más servidores si quieres
};
// -----------------------------------------

// Estado en memoria
const servers = {};
Object.values(CONFIG).forEach(cfg => {
  servers[cfg.name] = {
    cfg,
    process: null,
    logs: '',         // acumulamos logs (puedes rotarlo si crece mucho)
    commandQueue: []  // cola de comandos por si el proceso tarda en arrancar
  };
});

// Helper: (opcional) check Minecraft ping
async function checkMinecraft(cfg) {
  try {
    const s = await mcStatus(cfg.host, cfg.port, { timeout: 2000 });
    return { up: true, players: s.players ? s.players.online : null, motd: s.motd ? s.motd.clean : null };
  } catch (err) {
    return { up: false };
  }
}

// Endpoints HTTP (status/start/stop/logs)
app.get('/api/status', async (req, res) => {
  const result = {};
  for (const [name, state] of Object.entries(servers)) {
    const running = state.process && !state.process.killed;
    const ping = await checkMinecraft(state.cfg).catch(() => ({ up: false }));
    result[name] = { running: !!running, pid: running ? state.process.pid : null, ping };
  }
  res.json(result);
});

app.post('/api/start', (req, res) => {
  const { name } = req.body;
  const state = servers[name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  if (state.process && !state.process.killed) return res.status(400).json({ error: 'Ya en ejecución' });

  const spawnOpts = { cwd: state.cfg.dir, shell: true };
  const child = spawn(state.cfg.startCmd, [], spawnOpts);

  state.process = child;
  state.logs = '';
  state.commandQueue = [];

  // stdout -> almacenar y emitir por socket.io
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

  // Si había comandos encolados mientras arrancaba, enviarlos cuando stdin esté listo
  child.stdin && state.commandQueue.forEach(cmd => child.stdin.write(cmd + '\n'));
  state.commandQueue = [];

  res.json({ ok: true, pid: child.pid });
});

app.post('/api/stop', (req, res) => {
  const { name } = req.body;
  const state = servers[name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  if (!state.process || state.process.killed) return res.status(400).json({ error: 'No en ejecución' });

  try {
    // preferimos enviar "stop" por stdin para que el servidor haga un apagado correcto
    if (state.process.stdin && !state.process.killed) {
      state.process.stdin.write('stop\n');
      return res.json({ ok: true, method: 'stdin' });
    }
    // fallback forzado en Windows
    const pid = state.process.pid;
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
    killer.on('close', () => res.json({ ok: true, method: 'taskkill' }));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/logs/:name', (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  res.send(state.logs);
});

// Endpoint HTTP fallback para enviar comando (si no quieres usar websockets)
app.post('/api/command', (req, res) => {
  const { name, command } = req.body;
  const state = servers[name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  if (!state.process || state.process.killed) {
    // encolar para enviarlo cuando arranque
    state.commandQueue.push(command);
    return res.status(202).json({ ok: true, queued: true });
  }
  try {
    if (state.process.stdin) {
      state.process.stdin.write(command + '\n');
      return res.json({ ok: true, sent: command });
    } else {
      state.commandQueue.push(command);
      return res.status(202).json({ ok: true, queued: true });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Servir frontend estático (ajusta si tu frontend está en otra ruta)
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

// ========== socket.io ==========
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET','POST'] } // ajustar en producción
});

io.on('connection', socket => {
  console.log('Socket conectado', socket.id);

  // Un cliente puede pedir unirse a la "sala" de un servidor para recibir logs
  socket.on('join', (serverName) => {
    if (!servers[serverName]) {
      socket.emit('error_msg', `Servidor desconocido: ${serverName}`);
      return;
    }
    socket.join(serverName);
    // enviar historial de logs reciente
    socket.emit('log_history', { server: serverName, logs: servers[serverName].logs });
  });

  // Cliente envía comando: write en stdin
  socket.on('command', ({ server: serverName, command }) => {
    const state = servers[serverName];
    if (!state) {
      socket.emit('cmd_error', { server: serverName, error: 'Servidor desconocido' });
      return;
    }
    if (!state.process || state.process.killed) {
      // encolar si no está arrancado
      state.commandQueue.push(command);
      socket.emit('cmd_queued', { server: serverName, command });
      return;
    }
    try {
      if (state.process.stdin) {
        state.process.stdin.write(command + '\n');
        socket.emit('cmd_sent', { server: serverName, command });
      } else {
        state.commandQueue.push(command);
        socket.emit('cmd_queued', { server: serverName, command });
      }
    } catch (err) {
      socket.emit('cmd_error', { server: serverName, error: String(err) });
    }
  });

  socket.on('disconnect', () => {
    // nada especial por ahora
  });
});

// Inicia HTTP + socket.io
const PORT = 4000;
httpServer.listen(PORT, () => console.log(`Servidor backend escuchando en http://localhost:${PORT}`));
