# Programa Abaniko

Programa Abaniko es una aplicación web para gestionar alumnos, profesores, accesos, jornadas y fichas de seguimiento de la asociación. Funciona en local desde el ordenador y también está preparada para publicarse en Firebase Hosting.

## En Qué Consiste

La página centraliza la información diaria del programa:

- Registro, edición, consulta y eliminación de alumnos.
- Gestión de profesores con PIN de acceso.
- Control de entradas y salidas de profesores.
- Registro de jornadas y consulta de sus resúmenes.
- Programas específicos del alumno: ocio, deportes, inserción y datos de interés.
- Fichas de entrevista con historial de versiones para conservar cambios anteriores.
- Sincronización opcional con Firebase para compartir datos entre varios equipos.

## Cómo Funciona

La entrada principal es `Index.html`. Ese archivo redirige a `html/Index.html`, donde está la portada real de la aplicación.

Cuando un profesor inicia sesión con su PIN, puede acceder al panel principal. Desde ahí se entra a alumnos, profesores, jornadas, historial y nube. Los datos se guardan en el navegador y, si Firebase está configurado, también se sincronizan con Firestore.

La gestión de alumnos se hace desde `html/menu_anadir_alumno.html`. Desde esa pantalla se puede abrir la ficha principal, consultar alumnos, eliminar registros, completar programas y crear fichas de entrevista.

## Organización De Carpetas

- `html/`: páginas de la aplicación.
- `js/`: lógica principal y configuración de Firebase.
- `css/`: estilos visuales.
- `assets/`: imágenes e iconos.
- `backend/`: servidor local de Node.js.
- `data/`: datos locales en JSON.
- `config/`, `core/` y `supabase/`: archivos auxiliares o históricos de configuración.
- `README.md`: explicación general del proyecto.

Se mantienen en la raíz archivos como `package.json`, `firebase.json`, `firebase-firestore.rules` y los `.bat` porque son necesarios para arrancar, publicar o configurar la app sin romper accesos directos.

## Uso Local

Para abrir la aplicación en este ordenador, usa:

```bat
Abrir Programa Abaniko.bat
```

Ese archivo arranca el servidor local si hace falta y abre la página principal.

También se puede iniciar desde terminal:

```bash
npm start
```

Después se accede a:

```text
http://127.0.0.1:3000/Index.html
```

## Uso Online

La versión pública se publica con Firebase Hosting. Para subir cambios:

```bat
Publicar Programa Abaniko Online.bat
```

La web pública queda en:

```text
https://programaabaniko.web.app/
```

## Nota Importante De Seguridad

Si se van a guardar datos reales de alumnos, conviene proteger Firebase con usuarios y permisos. Las reglas actuales permiten que la aplicación funcione online, pero antes de usar datos sensibles en producción debería añadirse autenticación.
