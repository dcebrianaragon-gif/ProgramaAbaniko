@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se ha encontrado Node.js en este ordenador.
  echo Instala Node.js desde https://nodejs.org y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

echo.
echo Preparando Programa Abaniko para Netlify...
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo No se pudo preparar la carpeta dist.
  echo.
  pause
  exit /b 1
)

echo.
echo Publicando en Netlify...
echo Si Netlify pide iniciar sesion, ejecuta primero: npx netlify-cli login
echo.
cmd /c npx netlify-cli deploy --prod --dir dist

echo.
if errorlevel 1 (
  echo No se ha podido publicar en Netlify.
) else (
  echo Publicacion terminada.
)
echo.
pause
endlocal
