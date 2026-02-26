/**
 * Utilidades para la API de CurseForge:
 *  - Cabeceras de autenticación
 *  - Cálculo de fingerprint (MurmurHash2 32-bit, seed=1)
 */
import { CF_API_TOKEN } from '../config/env.js';

export const CF_BASE = 'https://api.curseforge.com/v1';

/**
 * Devuelve las cabeceras necesarias para cualquier petición a CurseForge.
 */
export function cfHeaders() {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-api-key': CF_API_TOKEN,
  };
}

// MurmurHash2 32-bit, seed=1 (algoritmo de fingerprint de CurseForge)
function murmur2_32(buf, seed) {
  const M = 0x5bd1e995;
  let h = (seed ^ buf.length) >>> 0;
  let i = 0;
  while (i + 4 <= buf.length) {
    let k = ((buf[i + 3] << 24) | (buf[i + 2] << 16) | (buf[i + 1] << 8) | buf[i]) >>> 0;
    k = Math.imul(k, M) >>> 0; k ^= k >>> 24; k = Math.imul(k, M) >>> 0;
    h = Math.imul(h, M) >>> 0; h = (h ^ k) >>> 0;
    i += 4;
  }
  switch (buf.length - i) {
    case 3: h = (h ^ (buf[i + 2] << 16)) >>> 0; // fallthrough
    case 2: h = (h ^ (buf[i + 1] << 8)) >>> 0;  // fallthrough
    case 1: h = (h ^ buf[i]) >>> 0; h = Math.imul(h, M) >>> 0;
  }
  h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, M) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return h >>> 0;
}

/**
 * Calcula el fingerprint de CurseForge para un buffer de archivo .jar.
 * Excluye bytes de espacio/tabulación/salto de línea antes de aplicar el hash.
 * @param {Buffer} fileBuffer
 * @returns {number}
 */
export function cfFingerprint(fileBuffer) {
  let count = 0;
  for (let i = 0; i < fileBuffer.length; i++) {
    const b = fileBuffer[i];
    if (b !== 9 && b !== 10 && b !== 13 && b !== 32) count++;
  }
  const filtered = Buffer.allocUnsafe(count);
  let j = 0;
  for (let i = 0; i < fileBuffer.length; i++) {
    const b = fileBuffer[i];
    if (b !== 9 && b !== 10 && b !== 13 && b !== 32) filtered[j++] = b;
  }
  return murmur2_32(filtered, 1);
}
