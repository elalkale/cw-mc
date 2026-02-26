/**
 * Resolución segura de rutas para evitar path traversal.
 * Usa path.resolve() para normalizar antes de comparar, lo que
 * elimina secuencias ../ independientemente del separador del OS.
 */
import path from 'path';

/**
 * Resuelve `relativePath` dentro de `serverDir` y verifica que
 * el resultado permanezca dentro del directorio base.
 *
 * @param {string} serverDir  - Directorio base (ruta absoluta)
 * @param {string} relativePath - Ruta relativa proporcionada por el usuario
 * @returns {string|null} Ruta absoluta normalizada, o null si está fuera del base
 */
export function resolveSafePath(serverDir, relativePath) {
  const resolvedBase   = path.resolve(serverDir);
  const resolvedTarget = path.resolve(path.join(serverDir, relativePath));

  // El target debe ser igual al base o estar estrictamente dentro de él
  const sep = path.sep;
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + sep)) {
    return null;
  }

  return resolvedTarget;
}
