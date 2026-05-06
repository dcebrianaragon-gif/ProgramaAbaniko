@echo off
set "APP_DIR=%~dp0"
set "APP_URL=http://127.0.0.1:3000"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $conn) { Start-Process -WindowStyle Hidden cmd.exe -ArgumentList '/c','cd /d ""%APP_DIR%"" && node backend\\server.js' }; Start-Sleep -Milliseconds 1500"

start "" "%APP_URL%"
