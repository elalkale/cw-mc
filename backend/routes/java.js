/**
 * Rutas de gestión de JREs descargados:
 *   GET  /api/java/status          — estado de cada versión (ready, progress…)
 *   POST /api/java/download/:ver   — inicia descarga del JRE indicado en background
 */
import express from 'express';
import { javaDownloads, isJavaReady, downloadJava } from '../services/javaManager.js';

const SUPPORTED_VERSIONS = [8, 17, 21];

const router = express.Router();

/**
 * @swagger
 * /api/java/status:
 *   get:
 *     summary: Obtener el estado de descarga de cada versión de JRE gestionado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de las versiones de Java soportadas (8, 17, 21)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   ready:
 *                     type: boolean
 *                     description: Si el JRE está descargado y listo para usar
 *                   status:
 *                     type: string
 *                     enum: [idle, downloading, done, error]
 *                   progress:
 *                     type: number
 *                     description: Progreso de descarga (0-100)
 *                   error:
 *                     type: string
 *                     description: Mensaje de error si hubo fallo
 *             example:
 *               "8":
 *                 ready: true
 *                 status: done
 *                 progress: 100
 *                 error: ""
 *               "17":
 *                 ready: false
 *                 status: idle
 *                 progress: 0
 *                 error: ""
 *               "21":
 *                 ready: false
 *                 status: idle
 *                 progress: 0
 *                 error: ""
 */
// GET /api/java/status
router.get('/status', (_req, res) => {
  const result = {};
  for (const ver of SUPPORTED_VERSIONS) {
    result[ver] = {
      ready:    isJavaReady(ver),
      status:   javaDownloads[ver]?.status   ?? 'idle',
      progress: javaDownloads[ver]?.progress ?? 0,
      error:    javaDownloads[ver]?.error    ?? '',
    };
  }
  res.json(result);
});

/**
 * @swagger
 * /api/java/download/{ver}:
 *   post:
 *     summary: Iniciar la descarga de un JRE gestionado en background
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ver
 *         required: true
 *         schema:
 *           type: integer
 *           enum: [8, 17, 21]
 *         description: Versión de Java a descargar
 *     responses:
 *       200:
 *         description: Descarga iniciada (o ya estaba en proceso / instalado)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 alreadyDownloading:
 *                   type: boolean
 *                   description: true si ya estaba descargando
 *                 alreadyInstalled:
 *                   type: boolean
 *                   description: true si ya estaba instalado
 *       400:
 *         description: Versión de Java no soportada
 */
// POST /api/java/download/:ver
router.post('/download/:ver', (req, res) => {
  const ver = parseInt(req.params.ver, 10);
  if (!SUPPORTED_VERSIONS.includes(ver)) {
    return res.status(400).json({ error: `Versión no soportada. Usa: ${SUPPORTED_VERSIONS.join(', ')}` });
  }
  if (javaDownloads[ver]?.status === 'downloading') {
    return res.json({ ok: true, alreadyDownloading: true });
  }
  if (isJavaReady(ver)) {
    return res.json({ ok: true, alreadyInstalled: true });
  }

  downloadJava(ver); // background — sin await
  res.json({ ok: true });
});

export default router;
