@echo off
echo Starting local full app ^(recommended^)...
echo This launches backend + frontend using scripts\dev.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev.ps1"
