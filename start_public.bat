@echo off
echo Starting local app with temporary public tunnel ^(recommended for sharing demos^)...
echo This launches backend + frontend and exposes the frontend through Cloudflare Quick Tunnel.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev.ps1" -PublicTunnel
