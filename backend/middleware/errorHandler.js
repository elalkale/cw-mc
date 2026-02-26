/**
 * Middleware global de manejo de errores.
 * Captura cualquier error no controlado y devuelve una respuesta JSON uniforme.
 */

/**
 * Handler de errores de Express (4 parámetros).
 * @param {Error} err
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  console.error('[Error no controlado]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : (err.message || 'Error interno del servidor'),
  });
}

/**
 * Handler para rutas no encontradas (404).
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}
