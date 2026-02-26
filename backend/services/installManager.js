/**
 * Gestión del estado de instalaciones de server packs.
 * Exporta el mapa `installs` y la función `runInstall`.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { CF_BASE, cfHeaders } from '../utils/curseforge.js';
import { refreshServers } from './serverManager.js';

// Compartido por referencia: todas las rutas que lo importen ven las mismas entradas
export const installs = {};

/**
 * Descarga e instala un server pack de CurseForge en background.
 * Actualiza `installs[installId]` con el estado del proceso.
 *
 * @param {string} installId
 * @param {number|string} modId
 * @param {number|string} fileId
 * @param {string} destDir - Ruta absoluta donde instalar
 * @param {object|null} meta - Metadatos del modpack para guardar en cw-mc-modpack.json
 */
export async function runInstall(installId, modId, fileId, destDir, meta) {
  try {
    installs[installId].status = 'installing';

    // 1. Obtener URL de descarga
    const urlResp = await fetch(
      `${CF_BASE}/mods/${modId}/files/${fileId}/download-url`,
      { headers: cfHeaders() }
    );
    const urlData = await urlResp.json();
    const downloadUrl = urlData?.data;
    if (!downloadUrl) throw new Error('No se pudo obtener la URL de descarga');

    // 2. Descargar el ZIP a un temporal
    const tmpFile = path.join(os.tmpdir(), `cw-mc-install-${installId}.zip`);
    const dlResp = await fetch(downloadUrl);
    if (!dlResp.ok) throw new Error(`Error descargando: ${dlResp.status}`);

    await new Promise((resolve, reject) => {
      const dest = createWriteStream(tmpFile);
      Readable.fromWeb(dlResp.body).pipe(dest);
      dest.on('finish', resolve);
      dest.on('error', reject);
    });

    // 3. Extraer ZIP al directorio de destino
    fs.mkdirSync(destDir, { recursive: true });
    const { extractZip } = await import('../utils/platform.js');
    await extractZip(tmpFile, destDir);

    // 4. Limpiar temp
    fs.rmSync(tmpFile, { force: true });

    // 4b. Guardar metadatos del modpack
    if (meta) {
      await fs.promises.writeFile(
        path.join(destDir, 'cw-mc-modpack.json'),
        JSON.stringify(meta, null, 2),
        'utf-8'
      );
    }

    // 5. Ejecutar script de instalación si existe (cross-platform)
    const { spawn } = await import('child_process');
    const { isWindows } = await import('../utils/platform.js');
    const batPath = path.join(destDir, 'install.bat');
    const shPath  = path.join(destDir, 'install.sh');

    if (isWindows && fs.existsSync(batPath)) {
      await new Promise((resolve, reject) => {
        const proc = spawn('cmd.exe', ['/c', 'install.bat'], { cwd: destDir });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(`install.bat terminó con código ${code}`)));
        proc.on('error', reject);
      });
    } else if (!isWindows && fs.existsSync(shPath)) {
      await new Promise((resolve, reject) => {
        const proc = spawn('bash', ['install.sh'], { cwd: destDir });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(`install.sh terminó con código ${code}`)));
        proc.on('error', reject);
      });
    }

    // 6. Refrescar lista de servidores
    refreshServers();
    installs[installId].status = 'done';
  } catch (err) {
    console.error('Error instalando server pack:', err);
    installs[installId].status = 'error';
    installs[installId].error = err.message;
  }
}
