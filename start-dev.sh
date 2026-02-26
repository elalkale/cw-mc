#!/usr/bin/env bash
# Script de desarrollo para Linux/macOS
# Equivalente a start-dev.bat para sistemas Unix

set -e

echo "==================================="
echo " Panel Minecraft - Modo Desarrollo"
echo "==================================="

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
  echo "❌ Node.js no encontrado. Instálalo desde https://nodejs.org"
  exit 1
fi

# Verificar que las dependencias están instaladas
if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependencias..."
  npm install
fi

echo "🚀 Iniciando backend y frontend con concurrently..."
echo "   Backend: http://localhost:4000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Presiona Ctrl+C para detener ambos procesos."
echo ""

npm run dev
