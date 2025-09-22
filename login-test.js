import fetch from 'node-fetch'; // npm install node-fetch@3
import * as tough from 'tough-cookie';
import fetchCookie from 'fetch-cookie';

// Creamos fetch con soporte de cookies
const cookieJar = new tough.CookieJar();
const fetchWithCookie = fetchCookie(fetch, cookieJar);

const login = async () => {
  const username = 'admin';
  const password = '1234';

  try {
    console.log('Intentando login...');

    const res = await fetchWithCookie('http://localhost:4000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    console.log('HTTP Status:', res.status);

    const data = await res.json();
    console.log('Respuesta del backend:', data);

    // Mostrar cookies guardadas
    const cookies = await cookieJar.getCookies('http://localhost:4000');
    console.log('Cookies guardadas:', cookies.map(c => c.cookieString()));

    // Probar endpoint protegido
    const protectedRes = await fetchWithCookie('http://localhost:4000/api/status', { credentials: 'include' });
    const protectedData = await protectedRes.json();
    console.log('Acceso a /api/status con sesión:', protectedData);

  } catch (err) {
    console.error('Error al hacer login:', err);
  }
};

login();
