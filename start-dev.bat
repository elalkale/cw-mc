@echo off
title Panel Minecraft - Desarrollo

echo ===================================
echo  Panel Minecraft - Modo Desarrollo
echo ===================================

:: Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Node.js no encontrado. Instalalo desde https://nodejs.org
  pause
  exit /b 1
)

:: Instalar dependencias si faltan
if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
)

echo Iniciando backend y frontend...
echo    Backend:  http://localhost:4000
echo    Frontend: http://localhost:5173
echo.
echo Presiona Ctrl+C para detener ambos procesos.
echo.

call npm run dev
