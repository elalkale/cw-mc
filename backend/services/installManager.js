/**
 * Gestión del estado de instalaciones de server packs.
 * Exporta el mapa `installs` y la función `runInstall`.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createWriteStream } from 'fs';
import { Readable, pipeline as streamPipeline } from 'stream';
import { promisify } from 'util';
import { CF_BASE, cfHeaders } from '../utils/curseforge.js';
import { refreshServers } from './serverManager.js';

const pipeline = promisify(streamPipeline);

// Compartido por referencia: todas las rutas que lo importen ven las mismas entradas
export const installs = {};

/**
 * Si el ZIP extrajo todo dentro de una única subcarpeta, mueve el contenido
 * un nivel arriba para que quede directamente en destDir.
 */
async function flattenIfNeeded(destDir) {
  try {
    const entries = fs.readdirSync(destDir);
    if (entries.length !== 1) return;
    const candidate = path.join(destDir, entries[0]);
    if (!fs.statSync(candidate).isDirectory()) return;

    for (const f of fs.readdirSync(candidate)) {
      await fs.promises.cp(
        path.join(candidate, f),
        path.join(destDir, f),
        { recursive: true }
      );
    }
    await fs.promises.rm(candidate, { recursive: true, force: true });
  } catch (err) {
    console.warn('[flattenIfNeeded] No se pudo aplanar la estructura del ZIP:', err.message);
  }
}

/**
 * Genera start-server.bat y start-server.sh en el directorio del servidor,
 * configurando JAVA_HOME al JRE gestionado correcto para esa versión de MC.
 * No sobreescribe start.bat / start.sh originales.
 */
export async function generateStartScripts(destDir, mcVersion) {
  const { getMcJavaVersion, getJavaDir, isJavaReady } = await import('./javaManager.js');
  const { isWindows } = await import('../utils/platform.js');

  const javaVer = getMcJavaVersion(mcVersion);
  const javaDir = isJavaReady(javaVer) ? getJavaDir(javaVer) : null;
  const javaNote = javaDir
    ? `Java ${javaVer} gestionado: ${javaDir}`
    : `Java ${javaVer} requerido — descárgalo desde el panel (Configuración → Java)`;

  // Leer JAR configurado desde cw-mc-config.json; fallback a 'server.jar'
  let serverJar = 'server.jar';
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(destDir, 'cw-mc-config.json'), 'utf-8'));
    if (cfg.serverJar) serverJar = cfg.serverJar;
  } catch {}

  // ── start-server.bat (Windows) ────────────────────────────────────────────
  const batLines = [
    '@echo off',
    `REM Generado por CW-MC — ${javaNote}`,
    '',
    javaDir
      ? `SET "JAVA_HOME=${javaDir}"`
      : 'REM Java gestionado no disponible, se usará el java del PATH',
    javaDir ? 'SET "PATH=%JAVA_HOME%\\bin;%PATH%"' : '',
    '',
    `  java -Xmx4G -Xms1G -jar "${serverJar}" nogui`,
    '  pause',
  ].filter(l => l !== undefined).join('\r\n');

  await fs.promises.writeFile(path.join(destDir, 'start-server.bat'), batLines, 'utf-8');

  // ── start-server.sh (Linux / macOS) ───────────────────────────────────────
  const shLines = [
    '#!/usr/bin/env bash',
    `# Generado por CW-MC — ${javaNote}`,
    '',
    javaDir
      ? `export JAVA_HOME="${javaDir}"`
      : '# Java gestionado no disponible, se usará el java del PATH',
    javaDir ? 'export PATH="$JAVA_HOME/bin:$PATH"' : '',
    '',
    `  java -Xmx4G -Xms1G -jar "${serverJar}" nogui`,
  ].filter(l => l !== undefined).join('\n');

  await fs.promises.writeFile(path.join(destDir, 'start-server.sh'), shLines, 'utf-8');
  if (!isWindows) {
    try { fs.chmodSync(path.join(destDir, 'start-server.sh'), 0o755); } catch { /* ignorar */ }
  }
}

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

    await pipeline(
      Readable.fromWeb(dlResp.body),
      createWriteStream(tmpFile)
    );

    // 3. Extraer ZIP al directorio de destino
    fs.mkdirSync(destDir, { recursive: true });
    const { extractZip } = await import('../utils/platform.js');
    await extractZip(tmpFile, destDir);

    // 3b. Aplanar si el ZIP extrajo todo en una única subcarpeta
    await flattenIfNeeded(destDir);

    // 4. Limpiar temp
    fs.rmSync(tmpFile, { force: true });

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

    // 6. Generar start-server.bat / start-server.sh con Java correcto
    const mcVersion = meta?.gameVersions?.[0] ?? '';
    await generateStartScripts(destDir, mcVersion);

    // 7. Guardar metadatos del modpack
    if (meta) {
      await fs.promises.writeFile(
        path.join(destDir, 'cw-mc-modpack.json'),
        JSON.stringify(meta, null, 2),
        'utf-8'
      );
    }

    // 8. Refrescar lista de servidores
    refreshServers();
    installs[installId].status = 'done';
  } catch (err) {
    console.error('Error instalando server pack:', err);
    installs[installId].status = 'error';
    installs[installId].error = err.message;
  }
}
