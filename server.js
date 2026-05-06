const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, "programa-abaniko.json");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
  ".bat": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
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
    updatedAt: new Date().toISOString()
  };
}

function normalize(data) {
  return {
    students: Array.isArray(data?.students) ? data.students : [],
    teachers: Array.isArray(data?.teachers) ? data.teachers : [],
    sessions: Array.isArray(data?.sessions) ? data.sessions : [],
    accessLogs: Array.isArray(data?.accessLogs) ? data.accessLogs : [],
    updatedAt: data?.updatedAt || new Date().toISOString()
  };
}

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await writeData(createEmptyState());
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return normalize(JSON.parse(raw));
}

async function writeData(data) {
  const normalized = normalize(data);
  normalized.updatedAt = new Date().toISOString();
  await fs.writeFile(DATA_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(payload);
}

function getSafeFilePath(urlPath) {
  const targetPath = urlPath === "/" ? "/Index.html" : urlPath;
  const decodedPath = decodeURIComponent(targetPath);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = path.join(ROOT_DIR, normalizedPath);
  if (!absolutePath.startsWith(ROOT_DIR)) {
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
        Allow: "GET,PUT,OPTIONS"
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

server.listen(PORT, HOST, async () => {
  await ensureDataFile();
  console.log(`Programa Abaniko disponible en http://${HOST}:${PORT}`);
});
