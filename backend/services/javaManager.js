/**
 * Gestión de JREs (Eclipse Adoptium/Temurin) para distintas versiones de Minecraft.
 * Descarga, extrae y expone el ejecutable java correcto para cada servidor.
 *
 * Almacenamiento: <PROJECT_ROOT>/java/<majorVersion>/
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { PROJECT_ROOT } from '../config/app.js';
import { isWindows, extractZip } from '../utils/platform.js';

// ── Estado de descargas en memoria ────────────────────────────────────────────
// { 8: { status: 'idle'|'downloading'|'done'|'error', progress: 0-100, error: '' } }
export const javaDownloads = {};

/**
 * Recorre un directorio recursivamente y quita el bit de solo lectura
 * de todos los archivos y carpetas (útil tras extraer JREs en Windows).
 * @param {string} dirPath
 */
function makeWritable(dirPath) {
  try {
    fs.chmodSync(dirPath, 0o755);
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name);
      try { fs.chmodSync(full, entry.isDirectory() ? 0o755 : 0o644); } catch { /* ignorar */ }
      if (entry.isDirectory()) makeWritable(full);
    }
  } catch { /* ignorar si el directorio no existe */ }
}

// ── Mapeo MC → Java ───────────────────────────────────────────────────────────

/**
 * Devuelve la versión mayor de Java necesaria para una versión de Minecraft dada.
 * @param {string} mcVersion  ej. '1.12.2', '1.19', '1.21.1'
 * @returns {8 | 17 | 21}
 */
export function getMcJavaVersion(mcVersion) {
  if (!mcVersion || mcVersion === 'Desconocida') return 17;
  const parts = mcVersion.split('.').map(Number);
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;

  if (minor < 17) return 8;
  if (minor < 20 || (minor === 20 && patch <= 4)) return 17;
  return 21; // 1.20.5+, 1.21+
}

// ── Rutas ─────────────────────────────────────────────────────────────────────

export function getJavaDir(majorVersion) {
  return path.join(PROJECT_ROOT, 'java', String(majorVersion));
}

export function getJavaExe(majorVersion) {
  const dir = getJavaDir(majorVersion);
  return isWindows
    ? path.join(dir, 'bin', 'java.exe')
    : path.join(dir, 'bin', 'java');
}

export function isJavaReady(majorVersion) {
  return fs.existsSync(getJavaExe(majorVersion));
}

// ── Descarga ──────────────────────────────────────────────────────────────────

/**
 * Descarga el JRE de la versión indicada desde Eclipse Adoptium en background.
 * Actualiza javaDownloads[majorVersion] con el progreso.
 * @param {8 | 17 | 21} majorVersion
 */
export async function downloadJava(majorVersion) {
  if (javaDownloads[majorVersion]?.status === 'downloading') return;

  javaDownloads[majorVersion] = { status: 'downloading', progress: 0, error: '' };

  try {
    // 1. Detectar plataforma y arquitectura
    const osName = isWindows ? 'windows'
      : process.platform === 'darwin' ? 'mac'
      : 'linux';
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';

    // 2. Llamar a la API de Adoptium para obtener la URL
    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot?architecture=${arch}&image_type=jre&os=${osName}&vendor=eclipse`;
    const apiResp = await fetch(apiUrl);
    if (!apiResp.ok) throw new Error(`Adoptium API error: ${apiResp.status}`);

    const assets = await apiResp.json();
    if (!Array.isArray(assets) || assets.length === 0) {
      throw new Error(`No se encontraron assets de Java ${majorVersion} para ${osName}/${arch}`);
    }

    const pkg = assets[0].binary.package;
    const downloadUrl = pkg.link;
    const isZip = pkg.name.endsWith('.zip');

    // 3. Descargar con seguimiento de progreso
    const tmpFile = path.join(os.tmpdir(), `cw-mc-java-${majorVersion}${isZip ? '.zip' : '.tar.gz'}`);
    const dlResp = await fetch(downloadUrl);
    if (!dlResp.ok) throw new Error(`Error descargando: ${dlResp.status}`);

    const totalSize = parseInt(dlResp.headers.get('content-length') || '0', 10);
    let downloaded = 0;

    await new Promise((resolve, reject) => {
      const dest = createWriteStream(tmpFile);
      const body = Readable.fromWeb(dlResp.body);

      body.on('data', chunk => {
        downloaded += chunk.length;
        if (totalSize > 0) {
          javaDownloads[majorVersion].progress = Math.round((downloaded / totalSize) * 90);
        }
      });

      body.pipe(dest);
      dest.on('finish', resolve);
      dest.on('error', reject);
      body.on('error', reject);
    });

    javaDownloads[majorVersion].progress = 92;

    // 4. Extraer
    const destDir = getJavaDir(majorVersion);
    fs.mkdirSync(destDir, { recursive: true });

    if (isZip) {
      // Windows: extraer zip a un dir temporal, luego mover el contenido de la subcarpeta
      const tmpExtract = destDir + '_tmp_extract';
      fs.mkdirSync(tmpExtract, { recursive: true });
      await extractZip(tmpFile, tmpExtract);

      // La subcarpeta raíz del JRE (ej: jdk-17.0.11+9-jre)
      const entries = fs.readdirSync(tmpExtract);
      const inner = entries.find(e => fs.statSync(path.join(tmpExtract, e)).isDirectory());
      if (inner) {
        const innerPath = path.join(tmpExtract, inner);
        // Copiar archivos del inner a destDir (rename falla en Windows entre directorios)
        for (const f of fs.readdirSync(innerPath)) {
          const src = path.join(innerPath, f);
          const dst = path.join(destDir, f);
          if (fs.existsSync(dst)) await fs.promises.rm(dst, { recursive: true, force: true });
          await fs.promises.cp(src, dst, { recursive: true });
        }
      }
      await fs.promises.rm(tmpExtract, { recursive: true, force: true });
      makeWritable(destDir);
    } else {
      // Linux/Mac: usar tar con --strip-components=1 para extraer directamente
      await new Promise((resolve, reject) => {
        const proc = spawn('tar', ['-xzf', tmpFile, '-C', destDir, '--strip-components=1'], {
          stdio: 'inherit',
        });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(`tar terminó con código ${code}`)));
        proc.on('error', reject);
      });
      makeWritable(destDir);
    }

    javaDownloads[majorVersion].progress = 98;

    // 5. Limpiar temporal
    fs.rmSync(tmpFile, { force: true });

    // 6. En Linux/Mac, marcar el binario como ejecutable
    if (!isWindows) {
      try { fs.chmodSync(getJavaExe(majorVersion), 0o755); } catch { /* ignorar */ }
    }

    javaDownloads[majorVersion].progress = 100;
    javaDownloads[majorVersion].status   = 'done';
    console.log(`✅  Java ${majorVersion} JRE instalado en ${destDir}`);
  } catch (err) {
    console.error(`Error descargando Java ${majorVersion}:`, err.message);
    javaDownloads[majorVersion].status = 'error';
    javaDownloads[majorVersion].error  = err.message;
  }
}
