@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 exit /b 0

cmd /c npx firebase-tools deploy --only firestore:rules --project programaabaniko --non-interactive >nul 2>nul
if errorlevel 1 (
  start "" "%~dp0Conectar Firebase.bat"
)

endlocal
