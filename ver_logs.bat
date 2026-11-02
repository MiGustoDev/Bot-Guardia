@echo off
title Bot de Sistemas - Monitor
cd /d "%~dp0"
npx pm2 monit
