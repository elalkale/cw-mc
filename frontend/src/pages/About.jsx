import React from "react";
import { Layers } from "lucide-react";
import { FaLinkedin, FaGithub } from "react-icons/fa";

const CREATORS = [
  {
    name: "Alejandro S.",
    role: "Full Stack Developer",
    linkedin: "https://www.linkedin.com/in/alejandro-soto-pamies-ab9ab9327/",   // ← cambia por la URL real
    github: "https://github.com/elalkale",
    description: "Diseño de arquitectura, backend con Node.js/Express y desarrollo de la interfaz React.",
  },
  {
    name: "Jesús G.",
    role: "Full Stack Developer",
    linkedin: "https://www.linkedin.com/in/jes%C3%BAs-gonz%C3%A1lez-g%C3%A1lvez-625527238/",
    github: "https://github.com/JesusGonzalezGs",
    description: "Desarrollo de funcionalidades frontend, integración con CurseForge y experiencia de usuario.",
  },
];

const STACK = [
  { label: "React 19",       color: "from-cyan-500 to-blue-500"    },
  { label: "Node.js",        color: "from-green-500 to-emerald-600" },
  { label: "Express 5",      color: "from-gray-500 to-gray-600"     },
  { label: "Socket.IO",      color: "from-purple-500 to-violet-600" },
  { label: "Tailwind CSS",   color: "from-sky-400 to-cyan-500"      },
  { label: "CurseForge API", color: "from-orange-500 to-amber-500"  },
  { label: "JWT",            color: "from-pink-500 to-rose-500"     },
  { label: "Vite",           color: "from-indigo-500 to-purple-500" },
];

export default function About({ darkMode }) {
  const bg = darkMode
    ? "bg-[radial-gradient(ellipse_at_top,_#1e1040_0%,_#0f0f1a_60%,_#0a0a14_100%)]"
    : "bg-[radial-gradient(ellipse_at_top,_#ede9fe_0%,_#f9f9ff_55%,_#faf5ff_100%)]";

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors ${bg}`}>

      {/* Blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-20 animate-pulse ${darkMode ? "bg-purple-600" : "bg-purple-400"}`} />
        <div className={`absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-15 animate-pulse ${darkMode ? "bg-pink-600" : "bg-pink-400"}`} style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-16 pb-24">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="text-center mb-14">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border mb-4 ${darkMode ? "bg-purple-500/10 border-purple-500/30 text-purple-300" : "bg-purple-100 border-purple-300/60 text-purple-700"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Acerca del proyecto
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-300 bg-clip-text text-transparent">
              Cube Watcher
            </span>
          </h1>
          <p className={`text-base max-w-xl mx-auto leading-relaxed ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
            Panel de administración de servidores Minecraft desarrollado como proyecto personal. Permite gestionar, monitorizar e instalar servidores de forma centralizada.
          </p>
        </div>

        {/* ── Foto compartida ─────────────────────────────────────────────────── */}
        <div className="flex justify-center mb-14">
          <div className={`relative rounded-3xl overflow-hidden shadow-2xl border ${darkMode ? "border-white/8 shadow-purple-900/50" : "border-purple-200/60 shadow-purple-300/30"}`}>
            <img
              src="/frontend/src/assets/creators.jpg"
              alt="Alejandro S. y Jesús G., desarrolladores de Cube Watcher"
              className="w-72 h-72 sm:w-96 sm:h-96 object-cover"
            />
            <div className={`absolute inset-0 ${darkMode ? "bg-gradient-to-t from-gray-900/70 via-transparent to-transparent" : "bg-gradient-to-t from-purple-900/30 via-transparent to-transparent"}`} />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm border ${darkMode ? "bg-black/50 border-white/10 text-gray-300" : "bg-white/70 border-purple-200/60 text-gray-700"}`}>
                Los creadores
              </span>
            </div>
          </div>
        </div>

        {/* ── Cards de creadores ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-14">
          {CREATORS.map(({ name, role, linkedin,github, description }) => (
            <div
              key={name}
              className={`rounded-2xl border p-6 flex flex-col gap-4 transition-all hover:-translate-y-0.5 ${darkMode
                ? "bg-white/4 border-white/8 hover:border-purple-500/30 shadow-lg"
                : "bg-white border-purple-100 hover:border-purple-200 shadow-sm hover:shadow-md"
              }`}
            >
              {/* Avatar placeholder */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {name[0]}
                </div>
                <div>
                  <p className={`font-semibold text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>{name}</p>
                  <p className={`text-xs ${darkMode ? "text-purple-400" : "text-purple-600"}`}>{role}</p>
                </div>
              </div>

              <p className={`text-xs leading-relaxed flex-1 ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                {description}
              </p>

              {/* Links */}
              <div className="flex flex-wrap gap-2">
                {linkedin && (
                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
                      ? "bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20 hover:border-blue-400/40"
                      : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    <FaLinkedin size={13} />
                    LinkedIn
                  </a>
                )}
                {github && (
                  <a
                    href={github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all hover:scale-[1.02] active:scale-95 ${darkMode
                      ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <FaGithub size={13} />
                    GitHub
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Stack tecnológico ───────────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-6 ${darkMode ? "bg-white/4 border-white/8" : "bg-white border-purple-100 shadow-sm"}`}>
          <div className="flex items-center gap-2 mb-5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? "bg-purple-500/15" : "bg-purple-100"}`}>
              <Layers size={14} className="text-purple-400" />
            </div>
            <h2 className={`font-semibold text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>Stack tecnológico</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {STACK.map(({ label, color }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r ${color} shadow-sm`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
