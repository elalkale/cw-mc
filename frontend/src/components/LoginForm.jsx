import React, { useState } from 'react';

export default function LoginForm({ onLogin }) {
  const [username, setUser] = useState('');
  const [password, setPass] = useState('');
  const [error, setError] = useState('');

  const login = async () => {
    try {
      const res = await fetch('http://localhost:4000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        onLogin();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('Error de conexión al backend');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Login</h2>
      <input placeholder="Usuario" value={username} onChange={e => setUser(e.target.value)} /><br/>
      <input type="password" placeholder="Contraseña" value={password} onChange={e => setPass(e.target.value)} /><br/>
      <button onClick={login}>Entrar</button>
      <p style={{ color: 'red' }}>{error}</p>
    </div>
  );
}
