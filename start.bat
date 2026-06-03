@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Please install Node.js 18 or newer, then run this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)

if not exist "img" mkdir "img"

start "" "http://localhost:3000"
node server.js
