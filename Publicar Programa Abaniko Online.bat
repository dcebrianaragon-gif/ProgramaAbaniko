@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Publicando Programa Abaniko en Firebase Hosting...
echo.
cmd /c npx firebase-tools deploy --only hosting,firestore:rules --project programaabaniko

echo.
if errorlevel 1 (
  echo No se ha podido publicar. Si Firebase pide iniciar sesión, ejecuta primero:
  echo npx firebase-tools login
) else (
  echo Publicación terminada.
  echo Web pública: https://programaabaniko.web.app
)
echo.
pause
