# Cube Watcher (anteriormente cw-mc)

**Cube Watcher** es un panel web moderno para administrar servidores de Minecraft, desarrollado con React, Vite y Express. Diseñado meticulosamente para ofrecer una experiencia de usuario premium, permite iniciar, detener y monitorear servidores de Minecraft desde una interfaz accesible, responsiva y estéticamente pulida.

## ✨ Características Principales

- **Control Total:** Inicia, detén y monitoriza múltiples servidores desde un solo panel.
- **Logs en Tiempo Real:** Consola integrada alimentada por WebSockets para ver la salida del servidor al instante.
- **Comandos Rápidos e Interactivos:** Envía comandos directamente al servidor desde la interfaz web, con botones de acceso rápido para acciones comunes (tiempo, clima, op).
- **Diseño Premium:** Interfaz de usuario rica construida con Tailwind CSS, ofreciendo transiciones suaves, efectos glassmorphism, modo oscuro integrado y una paleta de colores cuidada en tonos púrpuras y rosados.
- **Accesibilidad (WCAG 2.1 AA):**
  - Navegación completa por teclado con indicadores de foco personalizados (`:focus-visible`).
  - Soporte para lectores de pantalla mediante etiquetas ARIA dinámicas, `role="alert"`, `aria-live`, y `aria-hidden` en elementos decorativos.
  - *Focus traps* en modales (como el diálogo de cierre de sesión) para evitar que el teclado escape del contexto.
  - Respeto por preferencias del sistema operativo como `prefers-reduced-motion`.
- **Iconografía Minimalista:** Uso de `lucide-react` para iconos limpios y consistentes en toda la aplicación.

---

## 🏗️ Estructura del Proyecto

```text
├── backend/           # Backend Express para autenticación y control de servidores
│   └── index.js       # API REST y WebSocket para control y logs
├── frontend/          # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx            # Enrutador principal, Focus Traps y estado global
│   │   ├── main.jsx           # Punto de entrada de React
│   │   ├── index.css          # Estilos globales y reglas de Accesibilidad (WCAG)
│   │   ├── assets/            # Imágenes, logo y recursos visuales
│   │   ├── components/
│   │   │   ├── LoginForm.jsx      # Autenticación segura e interfaz responsiva
│   │   │   ├── Navbar.jsx         # Menú de navegación accesible y toggle de Modo Oscuro
│   │   │   ├── ServerCard.jsx     # Tarjeta de servidor en vista Grid/Lista
│   │   │   ├── ServerDetail.jsx   # Vista intrínseca de monitorización y consola
│   │   │   ├── LogsConsole.jsx    # Componente dedicado para el streaming de terminal
│   │   ├── pages/
│   │   │   ├── Home.jsx           # Landing page de presentación
│   │   │   ├── Dashboard.jsx      # Panel principal con selector de vistas
│   │   │   ├── ServerDetailPage.jsx # Contenedor detallado con Comandos Rápidos
│   ├── public/           # Archivos estáticos
│   ├── vite.config.js    # Configuración de compilación de Vite
│   ├── eslint.config.js  # Reglas de estilo ES
├── servers/            # Directorios de los servidores Minecraft locales
├── package.json        # Dependencias NPM y scripts de ejecución
└── README.md           # Esta documentación
```

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React 19, Vite, Tailwind CSS v3, React Router DOM v7, Socket.io-client, Lucide React.
- **Backend:** Node.js, Express 5, Socket.io, express-session, bcrypt.
- **Integración Minecraft:** `minecraft-server-util` para ping y recolección de metadata de servidores locales.

---

## 📖 Componentes Destacados

### Frontend
- **App.jsx**: Orquesta la sesión del usuario de forma reactiva comprobando JWTs y maneja el **Focus Trap** vital para el modal accesible de *Cierre de Sesión*.
- **Navbar.jsx**: Totalmente responsivo. En escritorio muestra navegación en línea; en móvil colapsa a un cajón deslizante operado mediante teclado y soporte `Escape`.
- **ServerCard.jsx / ServerDetail.jsx**: Interfaces interactivas para leer información estructurada (jugadores online, ping, estado PID del proceso Node hijo) y ver la transmisión de consola web en vivo de cada servidor individual.

### Backend (`backend/index.js`)
Actúa como capa middleware entre el cliente web y los demonios de Java nativos o servidores bedrock. 
- Emplea `child_process.spawn`.
- Gestiona la asignación de puertos dinámicamente según subcarpetas dentro del directorio `servers/`.
- Ofrece endpoints robustos de API y una sesión controlada por token JWT.

---

## 🔌 Referencia Rápida de Endpoint API

*El backend se expone en `localhost:4000` y requiere el encabezado `Authorization: Bearer <token>`.*

| Método | Ruta | Propósito |
| :--- | :--- | :--- |
| **POST** | `/login` | Retorna Token de Sesión. |
| **POST** | `/logout` | Destruye la sesión actual expuesta. |
| **GET** | `/api/status` | Polling en tiempo real del estado de procesos del SO y pings de servidores. |
| **GET** | `/api/server-icon/:name` | Resuelve y entrega dinámicamente el `server-icon.png` desde la subcarpeta local. |
| **POST** | `/api/start` | Levanta el demonio en subproceso (`spawn`). |
| **POST** | `/api/stop` | Finaliza el proceso (`stdin: stop`). |
| **POST** | `/api/command` | Transfiere comandos tipo consola a `stdin`. Si servidor apagado, encola en array interno. |

*La capa de WebSocket sincroniza los logs bidireccionalmente permitiendo múltiples clientes ver las mismas líneas en la consola del frontend simultáneamente reconectando a salas (`socket.join`).*

---

> Desarrollado con ❤️ prestando atención al código limpio, la seguridad y estándares modernos de Accesibilidad para todos los usuarios.
