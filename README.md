# Programa Abaniko

Programa Abaniko es una aplicacion local para gestionar alumnos, profesores, accesos, jornadas, programas y fichas de entrevista de la asociacion.

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

## Que Incluye

- Alta, edicion, consulta y eliminacion de alumnos.
- Imagen local en la ficha del alumno.
- Profesores con PIN y control de accesos.
- Jornadas y resumenes.
- Programas por alumno: datos de interes, deportes, insercion y ocio.
- Busqueda de alumnos en programas por nombre, fecha, discapacidad o DNI.
- Fichas de entrevista con historial de versiones.
- Exportacion e importacion de copias JSON.

## Carpetas

- `html/`: paginas de la aplicacion.
- `js/`: logica principal.
- `css/`: estilos visuales.
- `assets/`: imagenes e iconos.
- `backend/`: servidor local de Node.js.
- `data/`: base de datos local en JSON.
- `tools/`: scripts auxiliares.

## Copias De Seguridad

Desde la pantalla principal se puede usar `Exportar copia` para descargar un JSON con todos los datos. Para restaurarlo, usa `Importar copia`.
