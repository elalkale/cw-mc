/**
 * Rutas de autenticación: login, logout y verificación de sesión.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { JWT_SECRET, ADMIN_USER, ADMIN_PASS } from '../config/env.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Limitar intentos de login: máx. 10 por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 15 minutos.' },
});

// Hash de la contraseña en memoria (se calcula una vez al arrancar)
// En producción, ADMIN_PASS debería ser un hash bcrypt almacenado en .env
let passwordHash = null;
async function getPasswordHash() {
  if (!passwordHash) {
    // Si ya es un hash bcrypt ($2b$...) lo usamos directamente
    if (ADMIN_PASS.startsWith('$2')) {
      passwordHash = ADMIN_PASS;
    } else {
      passwordHash = await bcrypt.hash(ADMIN_PASS, 10);
    }
  }
  return passwordHash;
}

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Iniciar sesión y obtener un token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 loggedIn:
 *                   type: boolean
 *
 *       400:
 *         description: Error de autenticación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 loggedIn:
 *                   type: boolean
 *
 *       429:
 *         description: Demasiados intentos de inicio de sesión
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 loggedIn:
 *                   type: boolean
 *             examples:
 *               tooManyAttempts:
 *                 summary: Demasiados intentos
 *                 value:
 *                   error: Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 15 minutos.
 *                   loggedIn: false
 */
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos', loggedIn: false });
  }

  const hash = await getPasswordHash();
  const passwordMatch = await bcrypt.compare(password, hash);

  if (username !== ADMIN_USER || !passwordMatch) {
    return res.status(400).json({ error: 'Usuario o contraseña incorrectos', loggedIn: false });
  }

  const token = jwt.sign({ id: 1, username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ ok: true, token, loggedIn: true });
});

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Cerrar sesión (en el cliente, simplemente eliminar el token)
 *     responses:
 *       200:
 *         description: Cierre de sesión exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *
 *       400:
 *         description: Error al cerrar sesión
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: No se pudo cerrar sesión
 */
router.post('/logout', (_req, res) => res.json({ ok: true }));

// GET /api/me
router.get('/me', verifyToken, (req, res) => {
  res.json({ loggedIn: true, user: req.user });
});

export default router;
