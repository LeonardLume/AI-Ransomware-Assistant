@echo off
setlocal
cd /d "%~dp0frontend-web"
if not exist "node_modules" npm install
npm run dev
