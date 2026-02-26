/**
 * Middleware de autenticación JWT.
 * Verifica el token Bearer en Authorization y adjunta el usuario a req.user.
 */
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido', loggedIn: false });
    req.user = user;
    next();
  });
}
