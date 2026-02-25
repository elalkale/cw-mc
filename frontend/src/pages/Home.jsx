import React from "react";
import { Link } from "react-router-dom";
import { Server, Zap, Shield, LayoutGrid, Terminal, Download } from "lucide-react";

const FEATURES = [
  {
    icon: Server,
    color: "from-purple-500 to-purple-700",
    glow: "shadow-purple-500/20",
    title: "Gestión de servidores",
    desc: "Inicia, detén y monitoriza cada servidor desde un único panel.",
  },
  {
    icon: Zap,
    color: "from-pink-500 to-rose-600",
    glow: "shadow-pink-500/20",
    title: "Tiempo real",
    desc: "Logs en vivo, estado de conexión y jugadores activos al instante.",
  },
  {
    icon: LayoutGrid,
    color: "from-indigo-500 to-blue-600",
    glow: "shadow-indigo-500/20",
    title: "Catálogo de servidores",
    desc: "Explora e instala servidores de modpacks de CurseForge con un solo clic.",
  },
  {
    icon: Terminal,
    color: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/20",
    title: "Consola integrada",
    desc: "Envía comandos directamente desde la interfaz sin abrir ningún terminal.",
  },
  {
    icon: Download,
    color: "from-amber-500 to-orange-500",
    glow: "shadow-amber-500/20",
    title: "Backups & restauración",
    desc: "Crea y descarga copias de seguridad completas del mundo con un clic.",
  },
  {
    icon: Shield,
    color: "from-cyan-500 to-sky-600",
    glow: "shadow-cyan-500/20",
    title: "Acceso seguro",
    desc: "Autenticación con JWT y control de sesión protegido.",
  },
];

export default function Home({ darkMode }) {
  const bg = darkMode
    ? "bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]"
    : "bg-[radial-gradient(ellipse_at_top,_#ede9fe_0%,_#f9f9ff_55%,_#faf5ff_100%)]";

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden transition-colors ${bg}`}>

      {/* ── Blobs decorativos ─────────────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-25 animate-pulse ${darkMode ? "bg-purple-600" : "bg-purple-400"}`} />
        <div className={`absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full blur-3xl opacity-20 animate-pulse ${darkMode ? "bg-pink-600" : "bg-pink-400"}`} style={{ animationDelay: "2s" }} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-3xl opacity-10 ${darkMode ? "bg-indigo-500" : "bg-indigo-300"}`} style={{ animationDelay: "1s" }} />
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center text-center pt-20 pb-12 px-4">
        {/* Logo */}
        <div className={`mb-6 p-4 rounded-3xl shadow-2xl border ${darkMode ? "bg-white/5 border-white/10 shadow-purple-900/40" : "bg-white/70 border-purple-200/60 shadow-purple-200/60"}`}>
          <img
            src="/frontend/src/assets/logo.png"
            alt="Cube Watcher logo"
            className="w-20 h-20 object-contain"
          />
        </div>

        {/* Badge */}
        <div className={`mb-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${darkMode ? "bg-purple-500/10 border-purple-500/30 text-purple-300" : "bg-purple-100 border-purple-300/60 text-purple-700"}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Panel de administración Minecraft
        </div>

        {/* Título */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 leading-[1.08]">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-300 bg-clip-text text-transparent">
            Cube Watcher
          </span>
        </h1>

        {/* Subtítulo */}
        <p className={`text-base sm:text-lg md:text-xl max-w-xl leading-relaxed mb-8 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
          Gestiona, monitoriza e instala servidores de Minecraft desde una sola interfaz rápida y moderna.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Link
            to="/dashboard"
            className="px-8 py-3 text-sm sm:text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.03] active:scale-95"
          >
            Abrir Dashboard →
          </Link>
          <Link
            to="/catalog"
            className={`px-8 py-3 text-sm sm:text-base rounded-xl font-semibold border transition-all hover:scale-[1.03] active:scale-95 ${darkMode ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-white border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm"}`}
          >
            Ver catálogo
          </Link>
        </div>

        {/* Créditos pequeños */}
        <p className={`text-xs ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
          Desarrollado por <span className={`font-medium ${darkMode ? "text-gray-500" : "text-gray-500"}`}>Alejandro S. &amp; Jesús G.</span>
        </p>
      </section>

      {/* ── Feature cards ─────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-5xl mx-auto w-full px-4 pb-20">
        <p className={`text-center text-xs font-semibold uppercase tracking-widest mb-8 ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
          Todo lo que necesitas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, color, glow, title, desc }) => (
            <div
              key={title}
              className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:shadow-xl ${glow} ${darkMode ? "bg-white/4 border-white/8 hover:border-white/14" : "bg-white/80 border-purple-100 hover:border-purple-200 shadow-sm"}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br ${color} shadow-lg`}>
                <Icon size={17} className="text-white" />
              </div>
              <div>
                <h3 className={`font-semibold text-sm mb-1 ${darkMode ? "text-white" : "text-gray-900"}`}>{title}</h3>
                <p className={`text-xs leading-relaxed ${darkMode ? "text-gray-500" : "text-gray-500"}`}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
