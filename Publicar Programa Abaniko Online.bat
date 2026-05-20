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
echo Preparando Programa Abaniko para GitHub Pages...
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
echo Generando la carpeta dist para GitHub Pages...
echo Si ya tienes activado GitHub Pages con Actions, bastara con subir estos cambios al repositorio.
echo.
cmd /c npm run build

echo.
if errorlevel 1 (
  echo No se ha podido preparar la publicacion.
) else (
  echo Carpeta dist preparada correctamente.
)
echo.
pause
endlocal
