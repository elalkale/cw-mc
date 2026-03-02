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

/**
 * @swagger
 * /api/files/{name}:
 *   get:
 *     summary: Listar el contenido de un directorio del servidor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre del servidor
 *       - in: query
 *         name: path
 *         schema:
 *           type: string
 *         description: Ruta relativa dentro del servidor (por defecto /)
 *     responses:
 *       200:
 *         description: Listado de archivos y carpetas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 currentPath:
 *                   type: string
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       isDirectory:
 *                         type: boolean
 *       403:
 *         description: Acceso denegado (path traversal)
 *       404:
 *         description: Servidor o ruta no encontrada
 */
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

/**
 * @swagger
 * /api/files/{name}/content:
 *   get:
 *     summary: Leer el contenido de un archivo del servidor
 *     description: Para archivos de texto devuelve JSON con el contenido. Para imágenes devuelve el archivo directamente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre del servidor
 *       - in: query
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruta relativa al archivo
 *     responses:
 *       200:
 *         description: Contenido del archivo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 content:
 *                   type: string
 *       400:
 *         description: Falta el parámetro path o la ruta es una carpeta
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Servidor o archivo no encontrado
 */
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

/**
 * @swagger
 * /api/files/{name}/content:
 *   put:
 *     summary: Guardar el contenido de un archivo del servidor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruta relativa al archivo a escribir
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 description: Contenido del archivo (texto plano o base64)
 *               isBase64:
 *                 type: boolean
 *                 description: Si es true, content se interpreta como base64
 *     responses:
 *       200:
 *         description: Archivo guardado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       400:
 *         description: Falta path, contenido, o la ruta es una carpeta
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Servidor no encontrado
 */
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

/**
 * @swagger
 * /api/files/{name}/content:
 *   delete:
 *     summary: Eliminar un archivo o carpeta del servidor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruta relativa al archivo o carpeta a eliminar
 *     responses:
 *       200:
 *         description: Archivo o carpeta eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       403:
 *         description: Acceso denegado (no se puede eliminar la raíz)
 *       404:
 *         description: Servidor o archivo no encontrado
 */
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

/**
 * @swagger
 * /api/files/{name}/folder:
 *   post:
 *     summary: Crear una nueva carpeta dentro del servidor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruta relativa del directorio padre
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [folderName]
 *             properties:
 *               folderName:
 *                 type: string
 *                 description: Nombre de la nueva carpeta
 *     responses:
 *       200:
 *         description: Carpeta creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       400:
 *         description: Faltan parámetros o la carpeta ya existe
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Servidor no encontrado
 */
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

/**
 * @swagger
 * /api/files/{name}/file:
 *   post:
 *     summary: Crear un archivo vacío en el servidor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruta relativa del directorio donde se creará el archivo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileName]
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: Nombre del nuevo archivo
 *     responses:
 *       200:
 *         description: Archivo creado vacío
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       400:
 *         description: Faltan parámetros o el archivo ya existe
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Servidor no encontrado
 */
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

/**
 * @swagger
 * /api/files/{name}/upload:
 *   post:
 *     summary: Subir un archivo al servidor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         schema:
 *           type: string
 *         description: Directorio destino dentro del servidor (por defecto /)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Archivo subido correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       400:
 *         description: No se envió ningún archivo
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Servidor no encontrado
 */
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

/**
 * @swagger
 * /api/files/{name}/download:
 *   get:
 *     summary: Descargar un archivo del servidor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         schema:
 *           type: string
 *         description: Ruta relativa al archivo a descargar (por defecto /)
 *     responses:
 *       200:
 *         description: Descarga del archivo
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: La ruta apunta a una carpeta
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Servidor no encontrado
 */
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
