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
 * /login:
 *   post:
 *     summary: Iniciar sesión y obtener un token JWT
 *     description: Endpoint público. Limitado a 10 intentos por IP cada 15 minutos.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 format: password
 *                 example: tu_contraseña
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso — guarda el token para enviarlo en el header Authorization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   description: JWT válido por 24 horas
 *                 loggedIn:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Usuario o contraseña incorrectos, o campos vacíos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Usuario o contraseña incorrectos
 *                 loggedIn:
 *                   type: boolean
 *                   example: false
 *       429:
 *         description: Demasiados intentos — bloqueado por rate limiting
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 15 minutos.
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
 * /logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Endpoint público. El token JWT es stateless, el cliente debe descartarlo al recibir la respuesta.
 *     security: []
 *     responses:
 *       200:
 *         description: Cierre de sesión confirmado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 */
router.post('/logout', (_req, res) => res.json({ ok: true }));

/**
 * @swagger
 * /me:
 *   get:
 *     summary: Verificar sesión activa y obtener datos del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token válido — devuelve los datos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 loggedIn:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: admin
 *       401:
 *         description: Token ausente, inválido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token inválido
 */
router.get('/me', verifyToken, (req, res) => {
  res.json({ loggedIn: true, user: req.user });
});

export default router;
