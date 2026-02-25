// Punto central para toda comunicación con el backend.
// Cambia VITE_API_URL en .env para apuntar a otro servidor.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/**
 * fetch con el JWT de localStorage adjunto automáticamente.
 * Si el body es FormData no toca el Content-Type para que el navegador
 * pueda incluir el boundary correctamente.
 */
export async function fetchWithToken(url, options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = { ...options.headers };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] ??= 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}
