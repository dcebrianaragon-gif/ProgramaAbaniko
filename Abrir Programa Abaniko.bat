@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

set "APP_DIR=%~dp0"
set "APP_PORT=3000"
set "APP_URL=http://127.0.0.1:%APP_PORT%/Index.html"
set "HEALTH_URL=http://127.0.0.1:%APP_PORT%/api/health"
set "SUPABASE_URL=https://supabase.com/dashboard/project/hmgripzugbzhxkrlfhrx"
set "VERCEL_URL=https://programa-abaniko-xib9.vercel.app"

:menu
cls
echo ==========================================
echo            PROGRAMA ABANIKO
echo ==========================================
echo.
echo  1. Abrir programa en este ordenador
echo  2. Abrir panel de Supabase
echo  3. Abrir web en Vercel
echo  4. Publicar en Vercel
echo  5. Publicar en Netlify
echo  6. Salir
echo.
choice /c 123456 /n /m "Elige una opcion: "

if errorlevel 6 goto end
if errorlevel 5 goto deploy_netlify
if errorlevel 4 goto deploy_vercel
if errorlevel 3 goto open_vercel
if errorlevel 2 goto open_supabase
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

:open_supabase
start "" "%SUPABASE_URL%"
echo.
echo Supabase se ha abierto en el navegador.
timeout /t 2 >nul
goto menu

:open_vercel
start "" "%VERCEL_URL%"
echo.
echo La web de Vercel se ha abierto en el navegador.
timeout /t 2 >nul
goto menu

:deploy_vercel
call :check_node
if errorlevel 1 goto menu

echo.
echo Publicando en Vercel...
echo.
cmd /c npm run deploy:vercel

echo.
if errorlevel 1 (
  echo No se ha podido publicar en Vercel.
) else (
  echo Publicacion en Vercel terminada.
)
echo.
pause
goto menu

:deploy_netlify
call :check_node
if errorlevel 1 goto menu

echo.
echo Publicando en Netlify...
echo.
cmd /c npm run deploy:netlify

echo.
if errorlevel 1 (
  echo No se ha podido publicar en Netlify.
) else (
  echo Publicacion en Netlify terminada.
)
echo.
pause
goto menu

:end
endlocal
exit /b 0
