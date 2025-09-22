# Minecraft Server Panel

Panel web para gestionar servidores de Minecraft desde un navegador. Permite iniciar, detener, enviar comandos, ver logs en tiempo real y detectar nuevos servidores automáticamente.

## Tecnologías

- Backend: Node.js, Express, Socket.IO, express-session, CORS
- Frontend: React + Vite
- Minecraft util: `minecraft-server-util`
- Gestión de procesos: `child_process.spawn`

## Estructura de carpetas
```
cw-mc/
├─ backend/
│  └─ index.js           # Servidor Node.js
├─ frontend/
│  ├─ index.html
│  ├─ src/
│  │  ├─ App.jsx
│  │  ├─ main.jsx
│  │  └─ components/
│  │      ├─ LoginForm.jsx
│  │      ├─ ServerCard.jsx
│  │      └─ LogsConsole.jsx
├─ servers/
│  ├─ server1/
│  │  └─ start.bat
│  └─ server2/
├─ start-dev.bat         # Script para desarrollo rápido
├─ package.json
└─ README.md
```
## Requisitos

- Node.js v22 o superior
- Servidores Minecraft con script de arranque (`start.bat`)
- Windows (para el `.bat`) o adaptar a Linux/Mac

## Instalación rápida

1. Instalar dependencias:

npm install --prefix backend
npm install --prefix frontend

2. Ejecutar backend y frontend con un solo script:

start-dev.bat

Esto abrirá dos terminales:
- Backend: http://localhost:4000
- Frontend: http://localhost:5173

Usuario de prueba: admin / 1234

## Producción

1. Construir frontend:

npm run build --prefix frontend

2. Ejecutar backend:

node backend/index.js

Ahora el panel estará disponible en http://localhost:4000 y servirá los archivos estáticos del frontend.

## Uso rápido

- Login: admin / 1234
- Agregar servidores: crear carpetas en `servers/` → detectados automáticamente
- Start / Stop: botones en el panel
- Comandos y logs: consola en tiempo real por servidor

## Script start-dev.bat

Crea un archivo `start-dev.bat` en la raíz con este contenido:

@echo off
title Minecraft Server Panel - Desarrollo

REM Levantar backend
start cmd /k "cd backend && node index.js"

REM Levantar frontend
start cmd /k "cd frontend && npm run dev"

echo Backend y Frontend iniciados.
pause

