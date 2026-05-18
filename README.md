# Programa Abaniko

Programa Abaniko es una aplicacion web para gestionar alumnos, profesores, accesos, jornadas y fichas de seguimiento de la asociacion. Funciona en local desde este ordenador y tambien puede publicarse online con Netlify o Vercel.

## En Que Consiste

La pagina centraliza la informacion diaria del programa:

- Registro, edicion, consulta y eliminacion de alumnos.
- Gestion de profesores con PIN de acceso.
- Control de entradas y salidas de profesores.
- Registro de jornadas y consulta de sus resumenes.
- Programas especificos del alumno: ocio, deportes, insercion y datos de interes.
- Fichas de entrevista con historial de versiones para conservar cambios anteriores.
- Sincronizacion con Supabase para compartir datos entre varios equipos en tiempo real.

## Como Funciona

La entrada principal es `Index.html`. Ese archivo redirige a `html/Index.html`, donde esta la portada real de la aplicacion.

Cuando un profesor inicia sesion con su PIN, puede acceder al panel principal. Desde ahi se entra a alumnos, profesores, jornadas, historial y nube. Los datos se guardan en el navegador y tambien se sincronizan con Supabase en la tabla `app_state`.

La gestion de alumnos se hace desde `html/menu_anadir_alumno.html`. Desde esa pantalla se puede abrir la ficha principal, consultar alumnos, eliminar registros, completar programas y crear fichas de entrevista.

## Organizacion De Carpetas

- `html/`: paginas de la aplicacion.
- `js/`: logica principal y configuracion publica de Supabase.
- `css/`: estilos visuales.
- `assets/`: imagenes e iconos.
- `backend/`: servidor local de Node.js.
- `data/`: datos locales en JSON.
- `supabase/`: configuracion y migraciones de la base de datos.
- `config/` y `core/`: archivos auxiliares o historicos de configuracion.
- `tools/`: scripts de preparacion para publicar.
- `README.md`: explicacion general del proyecto.

Para Netlify y Vercel se genera una carpeta `dist/` con solo los archivos publicos necesarios: `Index.html`, `html/`, `css/`, `js/` y `assets/`.

## Uso Local

Para abrir la aplicacion en este ordenador, usa:

```bat
Abrir Programa Abaniko.bat
```

Ese archivo arranca el servidor local si hace falta y abre la pagina principal.

Tambien se puede iniciar desde terminal:

```bash
npm start
```

Despues se accede a:

```text
http://127.0.0.1:3000/Index.html
```

## Uso Online Con Netlify

Antes de publicar, genera la version publica:

```bash
npm run build
```

Si PowerShell bloquea `npm.ps1`, usa:

```bat
cmd /c npm run build
```

Netlify debe publicar la carpeta:

```text
dist
```

La app online se conecta a Supabase usando `js/supabase-config.js`. La tabla principal es `app_state` y guarda una copia completa del estado de la aplicacion en formato JSON.

## Uso Online Con Vercel

Vercel puede usar la misma compilacion estatica:

```bash
npm run build
```

La configuracion ya incluida en `vercel.json` indica:

```text
Build Command: npm run build
Output Directory: dist
```

Si quieres publicar desde terminal:

```bash
cmd /c npm run deploy:vercel
```

La app en Vercel tambien trabajara contra Supabase cuando se abra desde una URL publica, igual que en Netlify.

## Supabase

El proyecto conectado es:

```text
hmgripzugbzhxkrlfhrx
```

La tabla necesaria es `public.app_state`, con permisos RLS para la clave `anon` y Realtime activado. La app lee al abrir, guarda cuando hay cambios y escucha cambios externos con Supabase Realtime. Si Realtime no responde, mantiene una sincronizacion periodica como respaldo.

## Nota Importante De Seguridad

La clave `anon` es publica por diseno, pero las politicas RLS actuales permiten leer y escribir el estado de la app. Antes de guardar datos reales sensibles de alumnos en produccion conviene anadir autenticacion y permisos por usuario.

Copiar esto en google para acceder:
"agent-6a043f79d63c432ad72b666f--programaa.netlify.app"
