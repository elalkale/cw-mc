/**
 * Rutas de configuración del panel: lectura y actualización de serverRoot.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config/app.js';
import { setServerRoot, refreshServers } from '../services/serverManager.js';

const router = express.Router();

// GET /api/settings
router.get('/', (_req, res) => {
  res.json({ serverRoot: loadConfig().serverRoot });
});

// POST /api/settings
router.post('/', (req, res) => {
  const { serverRoot } = req.body;
  if (!serverRoot) {
    return res.status(400).json({ error: 'No se proporcionaron configuraciones válidas' });
  }

  const resolved = path.resolve(serverRoot);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return res.status(400).json({ error: 'La ruta proporcionada no es un directorio válido' });
  }

  setServerRoot(resolved);
  refreshServers();

  res.json({ ok: true, message: 'Ruta de servidores actualizada' });
});

export default router;
