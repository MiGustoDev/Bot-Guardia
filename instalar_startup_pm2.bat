@echo off
:: Comprobar si se ejecuta con permisos de Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ==============================================================
    echo  [AVISO] Se requieren permisos de Administrador.
    echo  Solicitando elevacion de permisos...
    echo ==============================================================
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

title Configurador Automatico PM2 - Bot de Sistemas
cd /d "%~dp0"

echo ==============================================================
echo       INSTALACION Y CONFIGURACION DE PM2 + AUTO-STARTUP
echo ==============================================================
echo.

echo [1/4] Instalando PM2 globalmente...
call npm install -g pm2
if %errorLevel% neq 0 (
    echo [ERROR] No se pudo instalar PM2. Asegurate de tener Node.js instalado.
    pause
    exit /b
)

echo.
echo [2/4] Instalando modulo de inicio automatico para Windows (pm2-windows-startup)...
call npm install -g pm2-windows-startup
if %errorLevel% neq 0 (
    echo [ERROR] No se pudo instalar pm2-windows-startup.
    pause
    exit /b
)

echo.
echo [3/4] Registrando PM2 como servicio de Windows...
call pm2-startup install

echo.
echo [4/4] Iniciando el Bot de Sistemas y guardando estado actual...
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo ==============================================================
echo  LISTO! Todo configurado con exito.
echo.
echo  - El bot ya esta corriendo en segundo plano.
echo  - Si la computadora se reinicia, el bot arrancara SOLO.
echo  - Dashboard disponible en: http://localhost:5000
echo ==============================================================
echo.
pause
