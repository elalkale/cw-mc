/**
 * Punto de entrada del backend.
 * Responsabilidad exclusiva: ensamblar Express, Socket.IO y montar los módulos.
 */
import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// ── Configuración ─────────────────────────────────────────────────────────────
import { PORT, CORS_ORIGIN } from './config/env.js';
import { PROJECT_ROOT } from './config/app.js';

// ── Servicios ────────────────────────────────────────────────────────────────
import { servers, refreshServers } from './services/serverManager.js';

// ── Middleware ────────────────────────────────────────────────────────────────
import { verifyToken } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// ── Rutas ─────────────────────────────────────────────────────────────────────
import authRoutes              from './routes/auth.js';
import settingsRoutes          from './routes/settings.js';
import filesRoutes             from './routes/files.js';
import modsRoutes              from './routes/mods.js';
import curseforgeRoutes        from './routes/curseforge.js';
import javaRoutes              from './routes/java.js';
import { createServerRoutes, shutdown } from './routes/servers.js';

// ── Express + HTTP Server ─────────────────────────────────────────────────────
const app        = express();
const httpServer = http.createServer(app);

app.use(express.json({ limit: '50mb' }));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'], credentials: true },
});

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config/env.js';

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Token no proporcionado'));
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Token inválido'));
    socket.userId   = decoded.id;
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

// ── Icono de servidor (público, sin auth) ─────────────────────────────────────
import { getServerRoot } from './services/serverManager.js';

app.get('/api/server-icon/:name', (req, res) => {
  // Validar que el nombre solo contenga caracteres seguros
  const name = req.params.name;
  if (!/^[a-zA-Z0-9_\-. ()[\]{}+]+$/.test(decodeURIComponent(name))) {
    return res.status(400).json({ error: 'Nombre de servidor inválido' });
  }
  const iconPath = path.join(getServerRoot(), decodeURIComponent(name), 'server-icon.png');
  if (!fs.existsSync(iconPath)) {
    return res.status(404).json({ error: 'Icono no encontrado' });
  }
  res.sendFile(iconPath);
});

// ── Rutas de autenticación (sin auth middleware) ───────────────────────────────
app.use('/', authRoutes);

// ── API Router (todas las rutas requieren token) ──────────────────────────────
const apiRouter = express.Router();
apiRouter.use(verifyToken);

apiRouter.get('/me', (req, res) => res.json({ loggedIn: true, user: req.user }));

apiRouter.use('/settings',   settingsRoutes);
apiRouter.use('/files',      filesRoutes);
apiRouter.use('/servers',    modsRoutes);
apiRouter.use('/curseforge', curseforgeRoutes);
apiRouter.use('/java',       javaRoutes);
apiRouter.use('/',           createServerRoutes(io));

app.use('/api', apiRouter);

// ── Servir frontend en producción ─────────────────────────────────────────────
const distPath = path.join(PROJECT_ROOT, 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
  app.use('/', express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Error handlers ────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Inicializar servidores ─────────────────────────────────────────────────────
refreshServers();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Arrancar ──────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`✅  Backend escuchando en http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   Frontend dev: http://localhost:5173`);
  }
});
