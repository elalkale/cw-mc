/**
 * Rutas de gestión de JREs descargados:
 *   GET  /api/java/status          — estado de cada versión (ready, progress…)
 *   POST /api/java/download/:ver   — inicia descarga del JRE indicado en background
 */
import express from 'express';
import { javaDownloads, isJavaReady, downloadJava } from '../services/javaManager.js';

const SUPPORTED_VERSIONS = [8, 17, 21];

const router = express.Router();

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
