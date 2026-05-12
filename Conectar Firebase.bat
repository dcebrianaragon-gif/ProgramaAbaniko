@echo off
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
echo Conectando Programa Abaniko con Firebase...
echo Proyecto: programaabaniko
echo Ruta de Firestore: app_state/programa-abaniko
echo.

cmd /c npx firebase-tools login
if errorlevel 1 (
  echo.
  echo No se pudo iniciar sesion en Firebase.
  echo Vuelve a intentarlo y acepta el acceso con tu cuenta de Google.
  echo.
  pause
  exit /b 1
)

cmd /c npx firebase-tools deploy --only firestore:rules --project programaabaniko
if errorlevel 1 (
  echo.
  echo No se pudieron publicar las reglas de Firestore.
  echo Revisa que el proyecto programaabaniko exista y que tu cuenta tenga permisos.
  echo.
  pause
  exit /b 1
)

echo.
echo Firebase conectado correctamente.
echo Ahora puedes sincronizar desde la pantalla de nube.
echo.
pause
endlocal
