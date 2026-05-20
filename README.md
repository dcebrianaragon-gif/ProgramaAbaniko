# Programa Abaniko

Programa Abaniko es una aplicacion para gestionar alumnos, profesores, accesos, jornadas, programas y fichas de entrevista de la asociacion. Puede trabajar en local y tambien sincronizar online con Supabase o con Google Sheets mediante Apps Script.

## Uso Local

La forma recomendada de abrirlo en este equipo es:

```bat
Abrir Programa Abaniko.bat
```

Tambien se puede iniciar desde terminal:

```bash
npm start
```

Despues entra en:

```text
http://127.0.0.1:3000/Index.html
```

## Base De Datos Local

La app guarda los datos en local. Cuando se abre con el servidor incluido, la base queda en:

```text
data/programa-abaniko.json
```

El navegador mantiene tambien una copia inmediata para evitar perdidas mientras se trabaja.

## Backend En Google Sheets

Para compartir los datos entre dispositivos se puede usar Google Sheets:

1. Crea una hoja nueva en Google Sheets.
2. Entra en `Extensiones > Apps Script`.
3. Pega el contenido de `tools/google-sheets-backend.gs`.
4. Despliega como `Aplicacion web`, ejecutando como tu usuario y con acceso para cualquiera con el enlace.
5. Copia la URL que termina en `/exec`.
6. En la app, abre `Bases de datos` y pega la URL en el apartado Google Sheets.

La app guarda el estado completo en la pestaña `app_state` de la hoja.

Importante: quien tenga la URL del Web App podria usar ese backend. Guarda ese enlace con cuidado si vas a meter datos reales.

Tambien puedes abrir la web con un enlace como este para dejar Google Sheets configurado en ese navegador:

```text
https://dcebrianaragon-gif.github.io/ProgramaAbaniko/?sheetsUrl=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2FTU_ID%2Fexec
```

Si al probar la URL `/exec` sale un error como `Funcion de script no encontrada: doGet` o `doPost`, la implementacion publicada de Apps Script no contiene todavia el codigo correcto. En ese caso:

1. Pega `tools/google-sheets-backend.gs` completo en Apps Script.
2. Guarda los cambios.
3. Ve a `Implementar > Gestionar implementaciones`.
4. Edita la aplicacion web y vuelve a desplegar una version nueva.

## Publicacion Online

La web online se genera como sitio estatico de una sola pagina y queda lista en `dist/`.

La publicacion recomendada es `GitHub Pages`, por ejemplo en:

```text
https://dcebrianaragon-gif.github.io/ProgramaAbaniko/
```

Pasos rapidos:

1. Ejecuta `npm run build`.
2. Sube la carpeta `dist` usando GitHub Pages o activa el workflow de `.github/workflows/deploy-pages.yml`.
3. Si vas a usar Google Sheets en la web publicada, configura este secreto en GitHub:

```text
ABANIKO_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/.../exec
```

La app sigue siendo compatible con Supabase desde `js/supabase-config.js` y con Google Sheets desde la URL `/exec`.

## Que Incluye

- Alta, edicion, consulta y eliminacion de alumnos.
- Imagen local en la ficha del alumno.
- Profesores con PIN y control de accesos.
- Jornadas y resumenes.
- Programas por alumno: datos de interes, deportes, insercion y ocio.
- Busqueda de alumnos en programas por nombre, fecha, discapacidad o DNI.
- Fichas de entrevista con historial de versiones.
- Backend opcional en Google Sheets.
- Exportacion e importacion de copias JSON.

## Carpetas

- `html/`: paginas de la aplicacion.
- `js/`: logica principal.
- `css/`: estilos visuales.
- `assets/`: imagenes e iconos.
- `backend/`: servidor local de Node.js.
- `data/`: base de datos local en JSON.
- `tools/`: scripts auxiliares, incluyendo el backend de Google Sheets.

## Copias De Seguridad

Desde la pantalla principal se puede usar `Exportar copia` para descargar un JSON con todos los datos. Para restaurarlo, usa `Importar copia`.
