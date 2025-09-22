# Panel de Control de Servidores Minecraft (cw-mc)

Este proyecto es un panel web para administrar servidores de Minecraft, desarrollado con React, Vite y Express. Permite iniciar, detener y monitorear servidores Minecraft desde una interfaz moderna y fácil de usar.

## Estructura del Proyecto

```
├── backend/           # Backend Express para autenticación y control de servidores
│   └── index.js       # API REST y WebSocket para control y logs
├── frontend/          # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx            # Componente principal, gestiona rutas y estado global
│   │   ├── main.jsx           # Punto de entrada React
│   │   ├── index.css, App.css # Estilos globales
│   │   ├── assets/            # Imágenes y recursos
│   │   ├── components/
│   │   │   ├── LoginForm.jsx      # Formulario de login y verificación de sesión
│   │   │   ├── Navbar.jsx         # Barra de navegación, modo oscuro y logout
│   │   │   ├── ServerCard.jsx     # Tarjeta resumen de cada servidor, muestra estado y logs
│   │   │   ├── ServerDetail.jsx   # Vista detallada de un servidor, logs y comandos
│   │   │   ├── LogsConsole.jsx    # Consola de logs en tiempo real
│   │   ├── pages/
│   │   │   ├── Home.jsx           # Página de bienvenida
│   │   │   ├── Dashboard.jsx      # Panel principal, lista y gestiona servidores
│   ├── public/           # Archivos públicos (favicon, imágenes)
│   ├── vite.config.js    # Configuración Vite
│   ├── eslint.config.js  # Configuración ESLint
├── servers/            # Directorios de servidores Minecraft gestionados
│   └── ...             # Archivos, mods, logs, configuraciones de cada servidor
├── package.json        # Dependencias y scripts
└── README.md           # Documentación
```

## Descripción de Componentes y Páginas

### `App.jsx`
- Componente raíz. Maneja el estado global: autenticación, servidores, modo oscuro, servidor activo.
- Define rutas (`/`, `/dashboard`) y renderiza componentes según el estado.
- Realiza peticiones al backend para obtener el estado de los servidores y controlar su inicio/detención.

### `main.jsx`
- Punto de entrada de la app React. Renderiza `<App />` en el DOM.

### `LoginForm.jsx`
- Formulario de login.
- Verifica sesión al cargar y permite iniciar sesión contra el backend.
- Muestra errores y estado de carga.

### `Navbar.jsx`
- Barra superior con título, botón de modo oscuro y menú de logout.
- Usa React Icons y gestiona apertura/cierre del menú con click fuera.

### `ServerCard.jsx`
- Tarjeta para cada servidor en el dashboard.
- Muestra nombre, icono, estado y logs en tiempo real usando WebSocket.
- Permite enviar comandos y ver historial de logs.

### `ServerDetail.jsx`
- Vista detallada de un servidor.
- Muestra icono, nombre, logs en tiempo real y permite enviar comandos.
- Botón para volver al dashboard.

### `LogsConsole.jsx`
- Consola de logs en tiempo real.
- Se conecta por WebSocket y muestra el historial y nuevos logs.

### `Home.jsx`
- Página de bienvenida.
- Presenta el panel y los autores, con imagen y botón para ir al dashboard.

### `Dashboard.jsx`
- Panel principal tras login.
- Lista todos los servidores disponibles como `ServerCard`.
- Permite seleccionar un servidor para ver detalles (`ServerDetail`).

## Backend (`backend/index.js`)
- API REST con Express para login, logout, verificación de sesión y control de servidores.
- WebSocket (Socket.io) para logs en tiempo real.
- Simula usuarios y gestiona sesiones con `express-session`.
- Usa `minecraft-server-util` para consultar estado de servidores.

## Documentación Técnica

### Arquitectura General
El sistema se compone de un frontend en React (Vite) y un backend en Express. La comunicación se realiza vía API REST y WebSocket (Socket.io) para logs en tiempo real y comandos.

### Componentes Frontend

- **LoginForm.jsx**: Formulario controlado con React, verifica sesión al cargar usando `/api/me` y permite login vía `/login`. Muestra errores y loading.
- **Navbar.jsx**: Barra superior con modo oscuro y logout. Usa React Icons y gestiona menú con click fuera.
- **ServerCard.jsx**: Tarjeta de servidor. Se conecta por WebSocket, muestra logs en tiempo real, estado, icono y permite enviar comandos.
- **ServerDetail.jsx**: Vista detallada de un servidor. Similar a ServerCard pero con más información y botón para volver.
- **LogsConsole.jsx**: Consola de logs. Recibe logs por WebSocket y los muestra en un `<pre>` autoscroll.
- **Home.jsx**: Landing page con presentación y autores.
- **Dashboard.jsx**: Panel principal. Lista servidores y permite seleccionar uno para ver detalles.
- **App.jsx**: Componente raíz. Maneja rutas, estado global (login, servidores, modo oscuro, servidor activo) y lógica de comunicación con backend.

### Backend Express

#### Estructura y Formación
- **index.js**: Punto de entrada. Configura Express, sesiones, CORS, rutas API, WebSocket y sirve el frontend.
- **Sesiones**: Usa `express-session` para autenticar usuarios. Solo usuarios autenticados pueden acceder a la API y WebSocket.
- **Gestión de servidores**: Detecta carpetas en `servers/`, asigna puertos, lee versión del jar y gestiona procesos con `child_process.spawn`.
- **Logs**: Captura stdout/stderr de los procesos y los envía por WebSocket.
- **Comandos**: Permite enviar comandos a los servidores vía stdin o cola si el proceso no está activo.

#### Endpoints API

Todos los endpoints requieren autenticación (sesión iniciada).

| Método | Endpoint                 | Descripción |
|--------|--------------------------|-------------|
| POST   | `/login`                 | Iniciar sesión. Body: `{ username, password }` |
| POST   | `/logout`                | Cerrar sesión |
| GET    | `/api/me`                | Verifica sesión activa. Responde `{ loggedIn, username }` |
| GET    | `/api/status`            | Devuelve estado de todos los servidores detectados |
| GET    | `/api/server-icon/:name` | Devuelve el icono PNG del servidor (si existe) |
| POST   | `/api/start`             | Inicia el servidor. Body: `{ name }` |
| POST   | `/api/stop`              | Detiene el servidor. Body: `{ name }` |
| GET    | `/api/logs/:name`        | Devuelve los logs actuales del servidor |
| POST   | `/api/command`           | Envía comando al servidor. Body: `{ name, command }` |

#### Ejemplos de uso de Endpoints

---

**POST `/login`**
- Body:
```json
{
  "username": "admin",
  "password": "1234"
}
```
- Respuesta exitosa:
```json
{ "ok": true }
```
- Respuesta error:
```json
{ "error": "Usuario o contraseña incorrectos" }
```

---

**POST `/logout`**
- Respuesta:
```json
{ "ok": true }
```

---

**GET `/api/me`**
- Respuesta si logueado:
```json
{ "loggedIn": true, "username": "admin" }
```
- Respuesta si no logueado:
```json
{ "loggedIn": false }
```

---

**GET `/api/status`**
- Respuesta:
```json
{
  "Servidor1": {
    "running": true,
    "pid": 1234,
    "ping": { "up": true, "players": 5, "motd": "Bienvenido" },
    "icon": "/server-icons/Servidor1/server-icon.png",
    "version": "1.21.1"
  },
  "Servidor2": { ... }
}
```

---

**GET `/api/server-icon/:name`**
- Respuesta: Imagen PNG del icono del servidor.
- Si no existe: status 404.

---

**POST `/api/start`**
- Body:
```json
{ "name": "Servidor1" }
```
- Respuesta exitosa:
```json
{ "ok": true, "pid": 1234 }
```
- Error:
```json
{ "error": "Servidor no encontrado" }
```

---

**POST `/api/stop`**
- Body:
```json
{ "name": "Servidor1" }
```
- Respuesta exitosa:
```json
{ "ok": true, "method": "stdin" }
```
- Error:
```json
{ "error": "No en ejecución" }
```

---

**GET `/api/logs/:name`**
- Respuesta: Texto plano con los logs actuales del servidor.
- Error:
```json
{ "error": "Servidor no encontrado" }
```

---

**POST `/api/command`**
- Body:
```json
{ "name": "Servidor1", "command": "say Hola!" }
```
- Respuesta exitosa:
```json
{ "ok": true, "sent": "say Hola!" }
```
- Si el servidor no está activo:
```json
{ "ok": true, "queued": true }
```
- Error:
```json
{ "error": "Servidor no encontrado" }
```

---

#### Ejemplos de eventos WebSocket

- `join`:
  - Cliente envía: `{ server: "Servidor1" }`
  - Servidor responde: `{ server: "Servidor1", logs: "..." }` (evento `log_history`)

- `log`:
  - Servidor envía: `{ server: "Servidor1", line: "[INFO] Servidor iniciado" }`

- `command`:
  - Cliente envía: `{ server: "Servidor1", command: "say Hola!" }`
  - Servidor responde: `{ server: "Servidor1", command: "say Hola!" }` (evento `cmd_sent`)
  - Si el comando se pone en cola: `{ server: "Servidor1", command: "say Hola!" }` (evento `cmd_queued`)
  - Si hay error: `{ server: "Servidor1", error: "Servidor desconocido" }` (evento `cmd_error`)
