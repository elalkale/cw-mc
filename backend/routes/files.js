/**
 * Rutas de gestión de archivos de servidores:
 * listar, leer, escribir, borrar, crear carpeta/archivo, subir y descargar.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import os from 'os';
import { servers } from '../services/serverManager.js';
import { resolveSafePath } from '../utils/pathValidator.js';

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

// GET /api/files/:name?path=...
router.get('/:name', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const relativePath = req.query.path || '/';
  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const items = await fs.promises.readdir(targetPath, { withFileTypes: true });
    const result = items
      .map(item => ({ name: item.name, isDirectory: item.isDirectory() }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ ok: true, currentPath: relativePath, items: result });
  } catch (err) {
    if (err.code === 'ENOENT')   return res.status(404).json({ error: 'La ruta no existe' });
    if (err.code === 'ENOTDIR')  return res.status(400).json({ error: 'La ruta no es una carpeta' });
    res.status(500).json({ error: 'Error interno al leer los archivos' });
  }
});

// GET /api/files/:name/content?path=...
router.get('/:name/content', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  if (!relativePath) return res.status(400).json({ error: 'Falta el parámetro path' });

  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const stats = await fs.promises.stat(targetPath);
    if (stats.isDirectory()) return res.status(400).json({ error: 'La ruta es una carpeta' });

    const ext = path.extname(targetPath).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
      res.sendFile(targetPath);
    } else {
      const content = await fs.promises.readFile(targetPath, 'utf8');
      res.json({ ok: true, content });
    }
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'El archivo no existe' });
    res.status(500).json({ error: 'Error interno al leer el archivo' });
  }
});

// PUT /api/files/:name/content?path=...
router.put('/:name/content', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  const { content, isBase64 } = req.body;

  if (!relativePath)         return res.status(400).json({ error: 'Falta el parámetro path' });
  if (content === undefined) return res.status(400).json({ error: 'Falta el contenido' });

  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    if (fs.existsSync(targetPath) && (await fs.promises.stat(targetPath)).isDirectory()) {
      return res.status(400).json({ error: 'No se puede sobrescribir una carpeta' });
    }
    if (isBase64) {
      const base64 = content.split(',')[1] || content;
      await fs.promises.writeFile(targetPath, Buffer.from(base64, 'base64'));
    } else {
      await fs.promises.writeFile(targetPath, content, 'utf8');
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error guardando archivo:', err);
    res.status(500).json({ error: 'Error interno al guardar el archivo' });
  }
});

// DELETE /api/files/:name/content?path=...
router.delete('/:name/content', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  if (!relativePath) return res.status(400).json({ error: 'Falta el parámetro path' });

  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath || targetPath === state.cfg.dir) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    await fs.promises.rm(targetPath, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'El archivo no existe' });
    res.status(500).json({ error: 'Error interno al borrar' });
  }
});

// POST /api/files/:name/folder?path=...
router.post('/:name/folder', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  const { folderName } = req.body;
  if (!relativePath || !folderName) return res.status(400).json({ error: 'Faltan parámetros' });

  const targetPath = resolveSafePath(state.cfg.dir, path.join(relativePath, folderName));
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    await fs.promises.mkdir(targetPath);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'EEXIST') return res.status(400).json({ error: 'La carpeta ya existe' });
    res.status(500).json({ error: 'Error interno al crear la carpeta' });
  }
});

// POST /api/files/:name/file?path=...
router.post('/:name/file', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const { path: relativePath } = req.query;
  const { fileName } = req.body;
  if (!relativePath || !fileName) return res.status(400).json({ error: 'Faltan parámetros' });

  const targetPath = resolveSafePath(state.cfg.dir, path.join(relativePath, fileName));
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  if (fs.existsSync(targetPath)) return res.status(400).json({ error: 'El archivo ya existe' });

  try {
    await fs.promises.writeFile(targetPath, '', 'utf8');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error interno al crear el archivo' });
  }
});

// POST /api/files/:name/upload?path=...
router.post('/:name/upload', upload.single('file'), async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });
  if (!req.file)  return res.status(400).json({ error: 'No se envió ningún archivo' });

  const relativePath = req.query.path || '/';
  const targetPath = resolveSafePath(
    state.cfg.dir,
    path.join(relativePath, req.file.originalname)
  );

  if (!targetPath) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    await fs.promises.copyFile(req.file.path, targetPath);
    await fs.promises.unlink(req.file.path);
    res.json({ ok: true });
  } catch (err) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    console.error('Error subiendo archivo:', err);
    res.status(500).json({ error: 'Error interno al procesar el archivo' });
  }
});

// GET /api/files/:name/download?path=...
router.get('/:name/download', async (req, res) => {
  const state = servers[req.params.name];
  if (!state) return res.status(404).json({ error: 'Servidor no encontrado' });

  const relativePath = req.query.path || '/';
  const targetPath = resolveSafePath(state.cfg.dir, relativePath);
  if (!targetPath) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const stats = await fs.promises.stat(targetPath);
    if (stats.isDirectory()) return res.status(400).json({ error: 'La ruta es una carpeta' });
    res.download(targetPath, path.basename(targetPath));
  } catch {
    res.status(500).json({ error: 'Error interno al descargar el archivo' });
  }
});

export default router;
