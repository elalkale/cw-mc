/**
 * Carga y valida las variables de entorno al arrancar.
 * Exporta las constantes de configuración usadas en el resto del backend.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Siempre carga el .env desde la raíz del proyecto
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Advertir sobre variables no definidas
const recommended = ['JWT_SECRET', 'ADMIN_USER', 'ADMIN_PASS', 'CURSEFORGE_API_TOKEN'];
for (const key of recommended) {
  if (!process.env[key]) {
    console.warn(`⚠️  Variable de entorno ${key} no definida. Se usará el valor por defecto.`);
  }
}

// Bloquear arranque en producción con secretos por defecto
if (process.env.NODE_ENV === 'production') {
  if (process.env.JWT_SECRET === 'supersecretkey' || !process.env.JWT_SECRET) {
    console.error('❌  JWT_SECRET no puede ser el valor por defecto en producción. Define un secreto seguro en .env');
    process.exit(1);
  }
  if (process.env.ADMIN_PASS === 'password' || !process.env.ADMIN_PASS) {
    console.error('❌  ADMIN_PASS no puede ser "password" en producción. Cambia la contraseña en .env');
    process.exit(1);
  }
}

export const PORT           = parseInt(process.env.PORT || '4000', 10);
export const CORS_ORIGIN    = process.env.CORS_ORIGIN || 'http://localhost:5173';
export const JWT_SECRET     = process.env.JWT_SECRET  || 'supersecretkey';
export const ADMIN_USER     = process.env.ADMIN_USER  || 'admin';
export const ADMIN_PASS     = process.env.ADMIN_PASS  || 'password';
export const CF_API_TOKEN   = process.env.CURSEFORGE_API_TOKEN || '';
