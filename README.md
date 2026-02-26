# Cube Watcher

Panel web para administrar servidores de Minecraft. Desarrollado con React 19 + TypeScript en el frontend y Express 5 + Node.js en el backend, con comunicación en tiempo real mediante Socket.io.

---

## Características

- **Control de servidores** — inicia, detiene, para forzosamente y monitoriza múltiples servidores desde un solo panel.
- **Logs en tiempo real** — consola integrada alimentada por WebSockets; múltiples clientes comparten la misma sala de logs.
- **Comandos interactivos** — envía comandos al servidor desde la interfaz, con accesos rápidos para las acciones más comunes.
- **Catálogo de modpacks** — integración con la API de CurseForge para explorar, filtrar e instalar server packs directamente desde el panel.
- **Instalación desatendida** — descarga, extrae y ejecuta el `install.bat`/`install.sh` del modpack en segundo plano, mostrando el progreso en tiempo real.
- **Explorador de archivos** — navega, edita, sube, descarga y elimina archivos del servidor desde el navegador.
- **Gestión de mods** — lista, activa/desactiva, sube y elimina mods `.jar`; identificación automática mediante fingerprint CurseForge (MurmurHash2).
- **Backup y clonado** — genera copias `.zip` del servidor y crea clones con un clic.
- **Modo oscuro** — paleta en tonos púrpuras, con transiciones suaves y soporte de `prefers-reduced-motion`.
- **Accesibilidad (WCAG 2.1 AA)** — navegación por teclado, `aria-current`, `role="dialog"`, `aria-live`, focus traps en modales y contraste adecuado en toda la interfaz.
- **Multiplataforma** — compatible con Windows y Linux/macOS sin necesidad de Docker.

---

## Estructura del proyecto

```
├── backend/
│   ├── index.js                  # Punto de entrada: Express, Socket.io y montaje de routers
│   ├── config/
│   │   ├── app.js                # loadConfig / saveConfig y rutas del proyecto
│   │   └── env.js                # Carga y validación de variables de entorno
│   ├── middleware/
│   │   ├── auth.js               # Middleware JWT (verifyToken)
│   │   └── errorHandler.js       # Handler global de errores y 404
│   ├── routes/
│   │   ├── auth.js               # POST /login, POST /logout, GET /api/me
│   │   ├── servers.js            # Control completo de servidores (start/stop/backup/clone...)
│   │   ├── files.js              # CRUD de archivos y directorios del servidor
│   │   ├── mods.js               # Enable/disable/upload/delete mods
│   │   ├── curseforge.js         # Proxy de la API de CurseForge
│   │   └── settings.js           # GET/POST de configuración global
│   ├── services/
│   │   ├── serverManager.js      # Estado global de servidores, ping, refresh
│   │   └── installManager.js     # Instalación de server packs en background
│   └── utils/
│       ├── curseforge.js         # Cabeceras CF y cálculo de fingerprint (MurmurHash2)
│       ├── pathValidator.js      # resolveSafePath con realpath anti path-traversal
│       └── platform.js           # killProcess, getStartCommand, extractZip cross-platform
│
├── frontend/
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx               # Enrutador principal, focus trap, estado global
│       ├── main.tsx
│       ├── types/index.ts        # Tipos TypeScript compartidos
│       ├── constants/index.ts    # LOADER_NAMES, LOADER_COLORS, intervalos, etc.
│       ├── hooks/
│       │   └── useFocusTrap.ts
│       ├── lib/
│       │   └── api.ts            # fetchWithToken, token helpers
│       ├── components/
│       │   ├── common/           # Modal.tsx, ErrorBoundary.tsx
│       │   ├── server/           # Componentes de servidor
│       │   ├── modpack/          # Componentes de catálogo y modpack
│       │   ├── ui/               # Navbar, LoginForm, FilterSelect, etc.
│       │   ├── ServerCard.tsx
│       │   ├── ServerDetail.tsx
│       │   ├── LogsConsole.tsx
│       │   ├── FileExplorer.tsx
│       │   ├── ModCatalog.tsx
│       │   ├── VersionsTab.tsx
│       │   ├── InstallModal.tsx
│       │   ├── DescriptionHTML.tsx   # Renderizado HTML con DOMPurify
│       │   └── ...
│       └── pages/
│           ├── Dashboard.tsx
│           ├── ServerDetailPage.tsx
│           ├── ServerCatalog.tsx
│           ├── ModpackDetail.tsx
│           └── ...
│
├── servers/                      # Directorios de los servidores Minecraft
├── package.json
├── start-dev.bat                 # Arranque en Windows
├── start-dev.sh                  # Arranque en Linux / macOS
└── .env                          # Variables de entorno (no incluido en el repositorio)
```

---

## Tecnologías

| Capa | Tecnologías |
|---|---|
| Frontend | React 19, TypeScript 5, Vite 7, Tailwind CSS 3, React Router 7, Socket.io-client, Lucide React |
| Backend | Node.js, Express 5, Socket.io 4, jsonwebtoken, bcrypt, express-rate-limit, unzipper |
| Seguridad | JWT + bcrypt, rate limiting en login, DOMPurify (XSS), path traversal bloqueado con `realpath` |
| Minecraft | `minecraft-server-util` (ping), CurseForge API (catálogo, fingerprint MurmurHash2) |

---

## Primeros pasos

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y edita los valores:

```env
PORT=4000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=cambia_esto_por_un_secreto_largo
ADMIN_USER=admin
ADMIN_PASS=cambia_esta_contraseña
CURSEFORGE_API_TOKEN=tu_api_key_de_curseforge
```

> En producción, `JWT_SECRET` y `ADMIN_PASS` no pueden ser los valores por defecto; el servidor rechazará el arranque.

### 3. Arrancar en desarrollo

**Windows:**
```bat
start-dev.bat
```

**Linux / macOS:**
```bash
chmod +x start-dev.sh && ./start-dev.sh
```

O directamente con npm:
```bash
npm run dev
```

Esto levanta el backend en `http://localhost:4000` y el frontend en `http://localhost:5173` de forma simultánea.

### 4. Build de producción

```bash
npm run build
```

Genera `dist/` en la raíz. El backend lo sirve automáticamente cuando `NODE_ENV=production`.

### 5. Arrancar en producción

```bash
npm start
# equivale a: NODE_ENV=production node backend/index.js
```

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Backend + frontend en modo desarrollo (concurrently) |
| `npm run build` | Compila TypeScript y genera el bundle de producción |
| `npm start` | Arranca solo el backend en modo producción |
| `npm run typecheck` | Comprobación de tipos TypeScript sin emitir archivos |
| `npm run lint` | ESLint sobre `frontend/src` |

---

## API — Referencia rápida

Todas las rutas bajo `/api` requieren el header `Authorization: Bearer <token>` salvo `/login` y `/logout`.

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/login` | Devuelve JWT de sesión |
| POST | `/logout` | Invalida la sesión |
| GET | `/api/me` | Datos del usuario autenticado |

### Servidores
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/status` | Estado de todos los servidores (proceso + ping MC) |
| GET | `/api/logs/:name` | Histórico de logs de un servidor |
| POST | `/api/start` | Inicia el servidor |
| POST | `/api/stop` | Detiene el servidor (`stop` vía stdin) |
| POST | `/api/force-stop` | Mata el proceso forzosamente |
| POST | `/api/command` | Envía comando al stdin (o encola si está parado) |
| GET | `/api/backup/:name` | Descarga backup `.zip` del servidor |
| POST | `/api/backup/:name/local` | Guarda backup local |
| POST | `/api/servers/:name/clone` | Clona el servidor |
| DELETE | `/api/servers/:name` | Elimina el servidor |
| POST | `/api/servers/upload` | Sube un server pack `.zip` para instalar |
| POST | `/api/install` | Instala server pack desde CurseForge |
| GET | `/api/install/:installId` | Estado de una instalación en curso |

### Archivos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/files/:name` | Lista archivos y directorios |
| GET | `/api/files/:name/content` | Lee el contenido de un archivo |
| PUT | `/api/files/:name/content` | Sobreescribe el contenido de un archivo |
| POST | `/api/files/:name/file` | Sube un archivo |
| POST | `/api/files/:name/folder` | Crea una carpeta |
| DELETE | `/api/files/:name/content` | Elimina un archivo o carpeta |
| GET | `/api/files/:name/download` | Descarga un archivo |

### Mods
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/servers/:name/mods` | Lista mods del servidor |
| POST | `/api/servers/:name/mods/upload` | Sube un mod `.jar` |
| POST | `/api/servers/:name/mods/toggle` | Activa / desactiva un mod |
| DELETE | `/api/servers/:name/mods/:filename` | Elimina un mod |
| POST | `/api/servers/:name/mods/identify` | Identifica mods mediante fingerprint CurseForge |
| POST | `/api/servers/:name/mods/install` | Instala un mod desde CurseForge |

### CurseForge
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/curseforge/mods/search` | Búsqueda de modpacks |
| GET | `/api/curseforge/mod/:modId` | Detalles de un mod |
| GET | `/api/curseforge/mod/:modId/description` | Descripción HTML del mod |
| GET | `/api/curseforge/mod/:modId/files` | Lista de archivos/versiones |
| GET | `/api/curseforge/mod/:modId/file/:fileId/download-url` | URL de descarga de un archivo |

### Icono de servidor (público, sin auth)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/server-icon/:name` | Devuelve `server-icon.png` del servidor |

---

> Desarrollado con atención al código limpio, la seguridad y los estándares modernos de accesibilidad.
