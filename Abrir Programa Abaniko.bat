@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

set "APP_DIR=%~dp0"
set "APP_PORT=3000"
set "APP_URL=http://127.0.0.1:%APP_PORT%/Index.html"
set "HEALTH_URL=http://127.0.0.1:%APP_PORT%/api/health"
set "GITHUB_PAGES_URL=https://dcebrianaragon-gif.github.io/ProgramaAbaniko/"

:menu
cls
echo ==========================================
echo            PROGRAMA ABANIKO
echo ==========================================
echo.
echo  1. Abrir programa en este ordenador
echo  2. Abrir web en GitHub Pages
echo  3. Preparar carpeta dist
echo  4. Salir
echo.
choice /c 1234 /n /m "Elige una opcion: "

if errorlevel 4 goto end
if errorlevel 3 goto build_static
if errorlevel 2 goto open_github_pages
if errorlevel 1 goto open_local

goto menu

:check_node
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se ha encontrado Node.js en este ordenador.
  echo Instala Node.js desde https://nodejs.org y vuelve a intentarlo.
  echo.
  pause
  exit /b 1
)
exit /b 0

:open_local
call :check_node
if errorlevel 1 goto menu

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
  goto menu
)

start "" "%APP_URL%"
echo.
echo Programa Abaniko se ha abierto en el navegador.
timeout /t 2 >nul
goto menu

:open_github_pages
start "" "%GITHUB_PAGES_URL%"
echo.
echo La web de GitHub Pages se ha abierto en el navegador.
timeout /t 2 >nul
goto menu

:build_static
call :check_node
if errorlevel 1 goto menu

echo.
echo Preparando carpeta dist para GitHub Pages...
echo.
cmd /c npm run build

echo.
if errorlevel 1 (
  echo No se ha podido preparar la carpeta dist.
) else (
  echo Carpeta dist preparada correctamente.
)
echo.
pause
goto menu

:end
endlocal
exit /b 0
