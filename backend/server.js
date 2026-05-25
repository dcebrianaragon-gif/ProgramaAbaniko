const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");
const { Pool } = require("pg");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const DISPLAY_HOST = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
const ROOT_DIR = __dirname;
const PROJECT_DIR = path.resolve(ROOT_DIR, "..");
const DATA_FILE = path.join(PROJECT_DIR, "data", "programa-abaniko.json");
const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const APP_STATE_KEY = "programa-abaniko";

const pool = DATABASE_URL
  ? new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false }
  })
  : null;

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

async function ensureDatabaseTable() {
  if (!pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      app_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureDataFile() {
  if (pool) {
    await ensureDatabaseTable();
    return;
  }
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.access(DATA_FILE);
  } catch {
    await writeData(createEmptyState());
  }
}

async function readData() {
  if (pool) {
    await ensureDatabaseTable();
    const result = await pool.query(
      "SELECT payload FROM app_state WHERE app_id = $1 LIMIT 1",
      [APP_STATE_KEY]
    );
    if (result.rows[0]?.payload) {
      return normalize(result.rows[0].payload);
    }
    return writeData(createEmptyState());
  }

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

  if (pool) {
    await ensureDatabaseTable();
    await pool.query(
      `
        INSERT INTO app_state (app_id, payload, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (app_id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [APP_STATE_KEY, JSON.stringify(normalized)]
    );
    return normalized;
  }

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
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
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
      storage: pool ? "postgres" : "json",
      dataFile: pool ? "" : DATA_FILE,
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
        Allow: "GET,PUT,OPTIONS",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
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
  console.log(`Programa Abaniko disponible en http://${DISPLAY_HOST}:${PORT}`);
  console.log(`Almacenamiento activo: ${pool ? "PostgreSQL (DATABASE_URL)" : DATA_FILE}`);
});
