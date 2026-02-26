/**
 * Utilidades cross-platform: kill de procesos, detección de script de inicio,
 * extracción de ZIP usando Node.js (sin PowerShell ni dependencias del SO).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export const isWindows = process.platform === 'win32';

/**
 * Mata un proceso y todo su árbol de hijos de forma cross-platform.
 * @param {number} pid - PID del proceso a matar
 */
export function killProcess(pid) {
  if (isWindows) {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { shell: false });
  } else {
    try {
      // -pid = matar grupo de procesos (árbol completo)
      process.kill(-pid, 'SIGKILL');
    } catch {
      // Si el proceso no tiene grupo, intentar matar directamente
      try { process.kill(pid, 'SIGKILL'); } catch { /* ya terminó */ }
    }
  }
}

/**
 * Devuelve el comando de inicio para un servidor Minecraft dado su directorio.
 * Prioriza start.bat en Windows y start.sh en Linux/Mac.
 * @param {string} serverDir
 * @returns {string} Nombre del script de inicio
 * @throws {Error} si no se encuentra ningún script
 */
export function getStartCommand(serverDir) {
  const batExists = fs.existsSync(path.join(serverDir, 'start.bat'));
  const shExists  = fs.existsSync(path.join(serverDir, 'start.sh'));

  if (isWindows && batExists) return 'start.bat';
  if (!isWindows && shExists)  return 'start.sh';
  if (batExists) return 'start.bat';  // fallback multiplataforma
  if (shExists)  return 'start.sh';
  throw new Error(`No se encontró script de inicio en ${serverDir} (start.bat o start.sh)`);
}

/**
 * Extrae un ZIP en un directorio de destino usando Node.js (unzipper).
 * Funciona igual en Windows y Linux, sin necesitar PowerShell.
 * @param {string} zipPath - Ruta al archivo ZIP
 * @param {string} destDir - Directorio de destino
 */
export async function extractZip(zipPath, destDir) {
  const unzipper = (await import('unzipper')).default;
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: destDir }))
      .on('close', resolve)
      .on('error', reject);
  });
}
