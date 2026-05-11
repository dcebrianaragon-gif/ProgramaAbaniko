@echo off
setlocal
set "APP_DIR=%~dp0"
set "APP_PORT=3000"
set "APP_URL=http://127.0.0.1:%APP_PORT%/Index.html"
set "HEALTH_URL=http://127.0.0.1:%APP_PORT%/api/health"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se ha encontrado Node.js en este ordenador.
  echo Instala Node.js desde https://nodejs.org y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = [int]'%APP_PORT%';" ^
  "$health = '%HEALTH_URL%';" ^
  "$appDir = '%APP_DIR%';" ^
  "$conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue;" ^
  "if (-not $conn) {" ^
  "  Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c', ('cd /d ""' + $appDir + '"" && node backend\server.js');" ^
  "}" ^
  "$ready = $false;" ^
  "for ($i = 0; $i -lt 30; $i++) {" ^
  "  try { $response = Invoke-WebRequest -Uri $health -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch { Start-Sleep -Milliseconds 500 }" ^
  "}" ^
  "if (-not $ready) { Write-Host 'El servidor no ha respondido a tiempo. Revisa la terminal o ejecuta: node backend\server.js'; exit 1 }"

if errorlevel 1 (
  echo.
  echo No se pudo arrancar Programa Abaniko.
  echo Prueba a ejecutar: node backend\server.js
  echo.
  pause
  exit /b 1
)

start "" "%APP_URL%"
start "" "%APP_DIR%Abrir Firebase Si Hace Falta.bat"
endlocal
