@echo off
title Bot de Sistemas - PM2 Launcher
cd /d "%~dp0"

echo ==============================================
echo   Iniciando Bot de Sistemas con PM2...
echo ==============================================

npx pm2 start ecosystem.config.js
npx pm2 save

echo.
echo ==============================================
echo   El bot ya esta corriendo en segundo plano!
echo   Dashboard accesible en: http://localhost:5000
echo ==============================================
pause
