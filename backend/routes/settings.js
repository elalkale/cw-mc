/**
 * Rutas de configuración del panel: lectura y actualización de serverRoot.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config/app.js';
import { setServerRoot, refreshServers } from '../services/serverManager.js';

const router = express.Router();

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Obtener la configuración actual del panel (ruta raíz de servidores)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración actual
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 serverRoot:
 *                   type: string
 *                   description: Ruta absoluta al directorio raíz donde se guardan los servidores
 */
// GET /api/settings
router.get('/', (_req, res) => {
  res.json({ serverRoot: loadConfig().serverRoot });
});

/**
 * @swagger
 * /api/settings:
 *   post:
 *     summary: Actualizar la ruta raíz de servidores y recargar el listado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serverRoot]
 *             properties:
 *               serverRoot:
 *                 type: string
 *                 description: Nueva ruta absoluta al directorio de servidores
 *     responses:
 *       200:
 *         description: Configuración actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: Ruta de servidores actualizada
 *       400:
 *         description: Ruta no proporcionada o directorio inválido
 */
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
