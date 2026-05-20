@echo off
chcp 65001 >nul
setlocal

echo.
echo Programa Abaniko usa Supabase o Google Sheets para la parte online.
echo.
echo Revisa la configuracion de js\supabase-config.js para Supabase.
echo.
echo La conexion de la pagina esta en:
echo js\supabase-config.js
echo.
echo Tambien puedes pegar la URL /exec de Google Apps Script desde la pantalla Bases de datos.
echo.
start "" "https://supabase.com/dashboard"
pause
endlocal
