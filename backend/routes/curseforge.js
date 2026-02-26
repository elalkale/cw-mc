/**
 * Proxy de la API de CurseForge.
 * Mantiene el API key en el backend y nunca lo expone al cliente.
 */
import express from 'express';
import { CF_BASE, cfHeaders } from '../utils/curseforge.js';
import { CF_API_TOKEN } from '../config/env.js';

const router = express.Router();

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

// GET /api/curseforge/mods/search
router.get('/mods/search', async (req, res) => {
  if (!CF_API_TOKEN) return res.json({ data: [], pagination: { totalCount: 0 } });
  try {
    const params = new URLSearchParams();
    params.set('gameId', '432');
    params.set('classId', '6');
    const allowed = ['searchFilter', 'gameVersion', 'modLoaderType', 'sortField', 'sortOrder', 'index', 'pageSize', 'categoryId'];
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

export default router;
