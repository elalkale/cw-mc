/**
 * Gestión de la configuración persistente (backend/config.json).
 * Exporta loadConfig / saveConfig y las rutas clave del proyecto.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH    = path.join(__dirname, '../config.json');
export const BACKEND_DIR    = path.join(__dirname, '..');
export const PROJECT_ROOT   = path.join(__dirname, '../..');

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig = { serverRoot: path.join(PROJECT_ROOT, 'servers') };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

export function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
