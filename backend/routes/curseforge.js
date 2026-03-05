/**
 * Proxy de la API de CurseForge.
 * Mantiene el API key en el backend y nunca lo expone al cliente.
 */
import express from 'express';
import { CF_BASE, cfHeaders } from '../utils/curseforge.js';
import { CF_API_TOKEN } from '../config/env.js';

const router = express.Router();

/**
 * @swagger
 * /api/curseforge/mods:
 *   post:
 *     summary: Obtener datos de múltiples mods de CurseForge por sus IDs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [modIds]
 *             properties:
 *               modIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Lista de IDs de mods en CurseForge
 *     responses:
 *       200:
 *         description: Datos de los mods solicitados (estructura de CurseForge API)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: modIds requeridos o formato inválido
 *       500:
 *         description: Error consultando CurseForge
 */
// POST /api/curseforge/mods — datos de varios mods a la vez
router.post('/mods', async (req, res) => {
  const { modIds } = req.body;
  if (!Array.isArray(modIds) || modIds.length === 0) {
    return res.status(400).json({ error: 'modIds requeridos' });
  }
  if (!CF_API_TOKEN) return res.json({ data: [] });
  try {
    const resp = await fetch(`${CF_BASE}/mods`, {
      method: 'POST',
      headers: cfHeaders(),
      body: JSON.stringify({ modIds }),
    });
    res.json(await resp.json());
  } catch (err) {
    console.error('CurseForge batch error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

/**
 * @swagger
 * /api/curseforge/mods/search:
 *   get:
 *     summary: Buscar mods en CurseForge con filtros
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: searchFilter
 *         schema:
 *           type: string
 *         description: Texto de búsqueda
 *       - in: query
 *         name: gameVersion
 *         schema:
 *           type: string
 *         description: Versión de Minecraft (ej. 1.21.4)
 *       - in: query
 *         name: modLoaderType
 *         schema:
 *           type: integer
 *         description: "Tipo de modloader (1=Forge, 4=Fabric, 5=Quilt, 6=NeoForge)"
 *       - in: query
 *         name: sortField
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: index
 *         schema:
 *           type: integer
 *         description: Offset de paginación
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Resultados por página
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Resultados de búsqueda de CurseForge
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *       500:
 *         description: Error consultando CurseForge
 */
// GET /api/curseforge/mods/search
router.get('/mods/search', async (req, res) => {
  if (!CF_API_TOKEN) return res.json({ data: [], pagination: { totalCount: 0 } });
  try {
    const params = new URLSearchParams();
    params.set('gameId', '432');
    // Allow caller to override classId (e.g. 6945 for datapacks, 12 for resource packs)
    if (!req.query.classId) params.set('classId', '6');
    const allowed = ['classId', 'searchFilter', 'gameVersion', 'modLoaderType', 'sortField', 'sortOrder', 'index', 'pageSize', 'categoryId'];
    for (const p of allowed) {
      if (req.query[p] !== undefined && req.query[p] !== '') params.set(p, req.query[p]);
    }
    const resp = await fetch(`${CF_BASE}/mods/search?${params}`, { headers: cfHeaders() });
    res.json(await resp.json());
  } catch (err) {
    console.error('CurseForge mods search error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

/**
 * @swagger
 * /api/curseforge/mod/{modId}:
 *   get:
 *     summary: Obtener información detallada de un mod de CurseForge
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del mod en CurseForge
 *     responses:
 *       200:
 *         description: Datos del mod (estructura de CurseForge API)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       500:
 *         description: Error consultando CurseForge
 */
// GET /api/curseforge/mod/:modId
router.get('/mod/:modId', async (req, res) => {
  if (!CF_API_TOKEN) return res.json({ data: null });
  try {
    const resp = await fetch(`${CF_BASE}/mods/${req.params.modId}`, { headers: cfHeaders() });
    res.json(await resp.json());
  } catch (err) {
    console.error('CurseForge single mod error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

/**
 * @swagger
 * /api/curseforge/mod/{modId}/description:
 *   get:
 *     summary: Obtener la descripción HTML de un mod de CurseForge
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del mod en CurseForge
 *     responses:
 *       200:
 *         description: Descripción en HTML del mod
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: string
 *                   description: Contenido HTML
 *       500:
 *         description: Error consultando CurseForge
 */
// GET /api/curseforge/mod/:modId/description
router.get('/mod/:modId/description', async (req, res) => {
  if (!CF_API_TOKEN) return res.json({ data: '' });
  try {
    const resp = await fetch(`${CF_BASE}/mods/${req.params.modId}/description`, { headers: cfHeaders() });
    res.json(await resp.json());
  } catch (err) {
    console.error('CurseForge description error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

/**
 * @swagger
 * /api/curseforge/mod/{modId}/files:
 *   get:
 *     summary: Listar los archivos disponibles de un mod de CurseForge
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: index
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset de paginación
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Lista de archivos del mod
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       500:
 *         description: Error consultando CurseForge
 */
// GET /api/curseforge/mod/:modId/files
router.get('/mod/:modId/files', async (req, res) => {
  if (!CF_API_TOKEN) return res.json({ data: [], pagination: {} });
  try {
    const { index = 0, pageSize = 50 } = req.query;
    const resp = await fetch(
      `${CF_BASE}/mods/${req.params.modId}/files?index=${index}&pageSize=${pageSize}`,
      { headers: cfHeaders() }
    );
    res.json(await resp.json());
  } catch (err) {
    console.error('CurseForge files error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

/**
 * @swagger
 * /api/curseforge/mod/{modId}/file/{fileId}/download-url:
 *   get:
 *     summary: Obtener la URL de descarga de un archivo específico de un mod
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: URL de descarga del archivo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: string
 *                   format: uri
 *                   nullable: true
 *       500:
 *         description: Error consultando CurseForge
 */
// GET /api/curseforge/mod/:modId/file/:fileId/download-url
router.get('/mod/:modId/file/:fileId/download-url', async (req, res) => {
  if (!CF_API_TOKEN) return res.json({ data: null });
  try {
    const resp = await fetch(
      `${CF_BASE}/mods/${req.params.modId}/files/${req.params.fileId}/download-url`,
      { headers: cfHeaders() }
    );
    res.json(await resp.json());
  } catch (err) {
    console.error('CurseForge download-url error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

// GET /api/curseforge/mod/:modId/file/:fileId/changelog
router.get('/mod/:modId/file/:fileId/changelog', async (req, res) => {
  if (!CF_API_TOKEN) return res.json({ data: '' });
  try {
    const resp = await fetch(
      `${CF_BASE}/mods/${req.params.modId}/files/${req.params.fileId}/changelog`,
      { headers: cfHeaders() }
    );
    res.json(await resp.json());
  } catch (err) {
    console.error('CurseForge changelog error:', err);
    res.status(500).json({ error: 'Error consultando CurseForge' });
  }
});

export default router;
