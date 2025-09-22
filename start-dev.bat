@echo off
title Minecraft Server Panel - Desarrollo

REM Levantar backend
start cmd /k "cd backend && node index.js"

REM Levantar frontend
start cmd /k "cd frontend && npm run dev"

echo Backend y Frontend iniciados.
pause