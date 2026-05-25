const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");
const db = require("./db");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const DISPLAY_HOST = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
const ROOT_DIR = __dirname;
const PROJECT_DIR = path.resolve(ROOT_DIR, "..");
const DATA_FILE = path.join(PROJECT_DIR, "data", "programa-abaniko.json");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
  ".bat": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".rules": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function createEmptyState() {
  return {
    students: [],
    teachers: [],
    sessions: [],
    accessLogs: [],
    absences: [],
    updatedAt: new Date().toISOString()
  };
}

function normalize(data) {
  return {
    students: Array.isArray(data?.students) ? data.students : [],
    teachers: Array.isArray(data?.teachers) ? data.teachers : [],
    sessions: Array.isArray(data?.sessions) ? data.sessions : [],
    accessLogs: Array.isArray(data?.accessLogs) ? data.accessLogs : [],
    absences: Array.isArray(data?.absences) ? data.absences : [],
    updatedAt: data?.updatedAt || new Date().toISOString()
  };
}

async function ensureDataFile() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.access(DATA_FILE);
  } catch {
    await writeData(createEmptyState());
  }
}

async function readData() {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return normalize(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      const brokenFile = `${DATA_FILE}.broken-${Date.now()}`;
      await fs.rename(DATA_FILE, brokenFile);
      console.warn(`JSON corrupto movido a ${brokenFile}`);
      return writeData(createEmptyState());
    }
    throw error;
  }
}

async function writeData(data) {
  const normalized = normalize(data);
  normalized.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const temporaryFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await fs.rename(temporaryFile, DATA_FILE);
  return normalized;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 10 * 1024 * 1024) {
      throw new Error("El cuerpo de la petición es demasiado grande.");
    }
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(payload);
}

function getSafeFilePath(urlPath) {
  const targetPath = urlPath === "/" ? "/Index.html" : urlPath;
  const decodedPath = decodeURIComponent(targetPath);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = path.join(PROJECT_DIR, normalizedPath);
  if (!absolutePath.startsWith(PROJECT_DIR)) {
    return null;
  }
  return absolutePath;
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health" && request.method === "GET") {
    const data = await readData();
    return sendJson(response, 200, {
      ok: true,
      backend: "node",
      storage: "json",
      dataFile: DATA_FILE,
      updatedAt: data.updatedAt
    });
  }

  if (pathname === "/api/data" && request.method === "GET") {
    const data = await readData();
    return sendJson(response, 200, data);
  }

  if (pathname === "/api/data" && request.method === "PUT") {
    const payload = await readBody(request);
    const saved = await writeData(payload);
    return sendJson(response, 200, saved);
  }

  if (pathname === "/api/registros" && request.method === "GET") {
    const registros = await db.getRegistros();
    return sendJson(response, 200, { ok: true, data: registros });
  }

  if (pathname.match(/^\/api\/registros\/\d+$/) && request.method === "GET") {
    const id = pathname.split('/').pop();
    const registro = await db.getRegistroById(parseInt(id));
    if (!registro) {
      return sendJson(response, 404, { ok: false, message: "Registro no encontrado" });
    }
    return sendJson(response, 200, { ok: true, data: registro });
  }

  if (pathname === "/api/registros" && request.method === "POST") {
    const payload = await readBody(request);
    const { nombre, email, telefono, contenido } = payload;

    if (!nombre) {
      return sendJson(response, 400, { ok: false, message: "El nombre es requerido" });
    }

    const registro = await db.addRegistro(nombre, email || null, telefono || null, contenido || null);
    return sendJson(response, 201, { ok: true, data: registro });
  }

  return sendJson(response, 404, { ok: false, message: "Ruta API no encontrada." });
}

async function handleStatic(response, pathname) {
  const filePath = getSafeFilePath(pathname);
  if (!filePath) {
    return sendText(response, 403, "Acceso denegado.");
  }

  try {
    const content = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream"
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return sendText(response, 404, "Archivo no encontrado.");
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const currentUrl = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        Allow: "GET,PUT,POST,OPTIONS",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      response.end();
      return;
    }

    if (currentUrl.pathname.startsWith("/api/")) {
      await handleApi(request, response, currentUrl.pathname);
      return;
    }

    await handleStatic(response, currentUrl.pathname);
  } catch (error) {
    console.error("Error interno del servidor:", error);
    sendJson(response, 500, {
      ok: false,
      message: "Error interno del servidor."
    });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`Programa Abaniko ya parece estar abierto en http://${DISPLAY_HOST}:${PORT}`);
    return;
  }
  throw error;
});

server.listen(PORT, HOST, async () => {
  await ensureDataFile();
  await db.initializeDatabase();
  console.log(`Programa Abaniko disponible en http://${DISPLAY_HOST}:${PORT}`);
  console.log(`Almacenamiento activo: ${DATA_FILE}`);
});
