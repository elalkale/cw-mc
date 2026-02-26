/// <reference types="vite/client" />

// Punto central para toda comunicación con el backend.
// En desarrollo Vite hace proxy de /api → localhost:4000.
// VITE_API_URL permite apuntar a otro servidor en producción.
export const API_BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * fetch con el JWT de localStorage adjunto automáticamente.
 * Si el body es FormData no toca el Content-Type para que el navegador
 * pueda incluir el boundary correctamente.
 */
export async function fetchWithToken(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] ??= 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}
