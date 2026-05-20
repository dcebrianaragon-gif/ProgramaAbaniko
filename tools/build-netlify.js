const fs = require("fs/promises");
const path = require("path");
const packageJson = require(path.join(__dirname, "..", "package.json"));

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const htmlDir = path.join(rootDir, "html");
const defaultPage = "Index.html";

const MIME_TYPES = {
  ".ico": "image/x-icon",
  ".png": "image/png"
};

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function toDataUri(filePath) {
  const content = await fs.readFile(filePath);
  return `data:${getMimeType(filePath)};base64,${content.toString("base64")}`;
}

function stripSharedAssets(html) {
  return html
    .replace(/<link\b[^>]*href=["'](?:\.\.\/)?css\/abaniko-styles\.css["'][^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*href=["'](?:\.\.\/)?assets\/abaniko-logo\.(?:png|ico)["'][^>]*>\s*/gi, "")
    .replace(/<script\b[^>]*src=["'](?:\.\.\/)?js\/(?:supabase-config|abaniko-app)\.js["'][^>]*>\s*<\/script>\s*/gi, "");
}

function getRefreshTarget(html) {
  const refreshMatch = html.match(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/i);
  if (!refreshMatch) {
    return "";
  }

  const contentMatch = refreshMatch[0].match(/content=["'][^"']*url=([^"';]+)[^"']*["']/i);
  return contentMatch ? contentMatch[1].trim() : "";
}

function removeRefreshMeta(html) {
  return html.replace(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>\s*/gi, "");
}

function appendBodyScript(html, script) {
  const scriptTag = `\n  <script>${script}</script>\n`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${scriptTag}</body>`);
  }
  return `${html}${scriptTag}`;
}

function rewriteLocationReplace(html) {
  const rewrite = (_match, target) => `AbanikoSingleFile.go(${JSON.stringify(target)})`;
  return html
    .replace(/\bwindow\.location\.replace\(\s*["']([^"']+\.html(?:[^"']*)?)["']\s*\)/gi, rewrite)
    .replace(/\blocation\.replace\(\s*["']([^"']+\.html(?:[^"']*)?)["']\s*\)/gi, rewrite);
}

function inlineAssets(html, assets) {
  return html
    .replace(/\.\.\/assets\/abaniko-logo\.png/g, assets.logoPng)
    .replace(/\.\.\/assets\/abaniko-logo\.ico/g, assets.logoIco)
    .replace(/assets\/abaniko-logo\.png/g, assets.logoPng)
    .replace(/assets\/abaniko-logo\.ico/g, assets.logoIco);
}

function transformPage(rawHtml, assets) {
  let html = normalizeLineEndings(rawHtml);
  const refreshTarget = getRefreshTarget(html);

  html = stripSharedAssets(html);
  html = removeRefreshMeta(html);
  html = rewriteLocationReplace(html);
  html = inlineAssets(html, assets);

  if (refreshTarget) {
    html = appendBodyScript(html, `AbanikoSingleFile.go(${JSON.stringify(refreshTarget)});`);
  }

  return html.trim();
}

function serializeForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function getBuildConfig() {
  const repositoryValue = typeof packageJson.repository === "string"
    ? packageJson.repository
    : (packageJson.repository?.url || "");
  const githubRepoUrl = String(repositoryValue || "")
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/i, "");
  const githubPagesUrl = String(packageJson.homepage || "").trim().replace(/\/+$/, "/");
  return {
    sheetsWebAppUrl: String(process.env.ABANIKO_SHEETS_WEB_APP_URL || "").trim(),
    githubRepoUrl,
    githubPagesUrl,
    githubPagesSettingsUrl: githubRepoUrl ? `${githubRepoUrl}/settings/pages` : "",
    githubActionsSecretsUrl: githubRepoUrl ? `${githubRepoUrl}/settings/secrets/actions` : ""
  };
}

async function buildPages(assets) {
  const files = await fs.readdir(htmlDir);
  const pages = {};

  for (const file of files.filter((entry) => entry.toLowerCase().endsWith(".html")).sort()) {
    const rawHtml = await fs.readFile(path.join(htmlDir, file), "utf8");
    pages[file] = transformPage(rawHtml, assets);
  }

  return pages;
}

function makeSingleFileHtml({ css, buildConfig, supabaseConfig, appScript, pages, assets }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Programa Abaniko</title>
  <link rel="icon" href="${assets.logoPng}" type="image/png">
  <link rel="shortcut icon" href="${assets.logoIco}" type="image/x-icon">
  <style>
${css}
  </style>
</head>
<body>
  <noscript>Activa JavaScript para abrir Programa Abaniko.</noscript>
  <script>
window.AbanikoBuildConfig = ${serializeForScript(buildConfig)};
  </script>
  <script>
${supabaseConfig}
  </script>
  <script>
${appScript}
  </script>
  <script>
(() => {
  const PAGES = ${serializeForScript(pages)};
  const DEFAULT_PAGE = ${JSON.stringify(defaultPage)};
  const PAGE_LOOKUP = Object.fromEntries(Object.keys(PAGES).map((page) => [page.toLowerCase(), page]));
  const nativeOpen = window.open.bind(window);

  function splitTarget(rawTarget) {
    const target = String(rawTarget || "").trim();
    const hashIndex = target.indexOf("#");
    const queryIndex = target.indexOf("?");
    const cutPoints = [hashIndex, queryIndex].filter((index) => index >= 0);
    const firstCut = cutPoints.length ? Math.min(...cutPoints) : target.length;
    return {
      path: target.slice(0, firstCut),
      hash: hashIndex >= 0 ? target.slice(hashIndex) : ""
    };
  }

  function normalizePage(rawTarget) {
    if (!rawTarget) {
      return DEFAULT_PAGE;
    }

    const target = String(rawTarget).trim();
    if (/^(?:https?:|mailto:|tel:|blob:|data:)/i.test(target)) {
      return "";
    }

    const parts = splitTarget(target);
    const cleanPath = parts.path.replace(/\\\\/g, "/").replace(/^\\.\\//, "");
    const fileName = cleanPath.split("/").filter(Boolean).pop() || DEFAULT_PAGE;
    const decodedFileName = decodeURIComponent(fileName);
    const lowerFileName = decodedFileName.toLowerCase();
    if (lowerFileName === "index.html") {
      return DEFAULT_PAGE;
    }
    return PAGES[fileName] ? fileName : (PAGES[decodedFileName] ? decodedFileName : (PAGE_LOOKUP[lowerFileName] || ""));
  }

  function normalizeBasePath(pathname) {
    let basePath = String(pathname || "/").replace(/\\/+/g, "/");
    if (basePath.length > 1) {
      basePath = basePath.replace(/\/+$/, "");
    }
    if (/\/html$/i.test(basePath)) {
      basePath = basePath.slice(0, -5) || "/";
    }
    return basePath || "/";
  }

  function resolveBasePath() {
    const pathname = String(window.location.pathname || "/").replace(/\\/+/g, "/");
    if (!pathname || pathname === "/") {
      return "/";
    }
    if (pathname.endsWith("/")) {
      return pathname;
    }

    const pageFromPath = normalizePage(pathname);
    if (pageFromPath) {
      const marker = pathname.toLowerCase().lastIndexOf(pageFromPath.toLowerCase());
      if (marker >= 0) {
        return normalizeBasePath(pathname.slice(0, marker)) + "/";
      }
    }

    if (/\/(?:index|404)\.html?$/i.test(pathname)) {
      return normalizeBasePath(pathname.replace(/\/(?:index|404)\.html?$/i, "")) + "/";
    }

    const lastSlash = pathname.lastIndexOf("/");
    if (lastSlash >= 0) {
      return normalizeBasePath(pathname.slice(0, lastSlash)) + "/";
    }

    return "/";
  }

  const APP_BASE_PATH = resolveBasePath();

  function makePageUrl(page, hash = "") {
    const url = new URL(window.location.href);
    url.pathname = APP_BASE_PATH;
    url.search = "";
    url.hash = "";
    if (page && page !== DEFAULT_PAGE) {
      url.searchParams.set("page", page);
    }
    if (hash) {
      url.hash = hash;
    }
    return url.toString();
  }

  function go(rawTarget) {
    const page = normalizePage(rawTarget);
    if (!page) {
      window.location.href = rawTarget;
      return;
    }

    const parts = splitTarget(rawTarget);
    window.location.href = makePageUrl(page, parts.hash);
  }

  function getRequestedPage() {
    const requested = new URLSearchParams(window.location.search).get("page");
    if (requested) {
      return normalizePage(requested) || DEFAULT_PAGE;
    }
    return normalizePage(window.location.pathname) || DEFAULT_PAGE;
  }

  function executeScripts(scripts) {
    for (const oldScript of scripts) {
      if (oldScript.src) {
        continue;
      }

      const script = document.createElement("script");
      for (const attribute of oldScript.attributes) {
        script.setAttribute(attribute.name, attribute.value);
      }
      script.textContent = oldScript.textContent;
      document.body.appendChild(script);
    }
  }

  function renderPage(page) {
    const html = PAGES[page] || PAGES[DEFAULT_PAGE];
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const title = parsed.querySelector("title");
    const scripts = Array.from(parsed.querySelectorAll("script"));

    scripts.forEach((script) => script.remove());
    document.title = title ? title.textContent : "Programa Abaniko";
    document.body.innerHTML = parsed.body ? parsed.body.innerHTML : "";
    executeScripts(scripts);
  }

  window.AbanikoSingleFile = { go, normalizePage };

  window.open = function openSingleFilePage(url, target, features) {
    const page = normalizePage(url);
    const targetName = String(target || "_self").toLowerCase();
    if (page && (targetName === "_self" || targetName === "")) {
      go(url);
      return null;
    }
    return nativeOpen(url, target, features);
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest ? event.target.closest("a[href]") : null;
    if (!link || link.target && link.target !== "_self") {
      return;
    }

    const page = normalizePage(link.getAttribute("href"));
    if (!page) {
      return;
    }

    event.preventDefault();
    go(link.getAttribute("href"));
  });

  renderPage(getRequestedPage());
})();
  </script>
</body>
</html>
`;
}

async function main() {
  const buildConfig = getBuildConfig();
  const assets = {
    logoPng: await toDataUri(path.join(rootDir, "assets", "abaniko-logo.png")),
    logoIco: await toDataUri(path.join(rootDir, "assets", "abaniko-logo.ico"))
  };
  const css = normalizeLineEndings(await fs.readFile(path.join(rootDir, "css", "abaniko-styles.css"), "utf8"));
  const supabaseConfig = normalizeLineEndings(await fs.readFile(path.join(rootDir, "js", "supabase-config.js"), "utf8"));
  const appScript = normalizeLineEndings(await fs.readFile(path.join(rootDir, "js", "abaniko-app.js"), "utf8"));
  const pages = await buildPages(assets);
  const output = makeSingleFileHtml({ css, buildConfig, supabaseConfig, appScript, pages, assets });

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(path.join(distDir, "index.html"), output, "utf8");
  await fs.writeFile(path.join(distDir, "404.html"), output, "utf8");
  await fs.writeFile(path.join(distDir, ".nojekyll"), "", "utf8");

  console.log(`Sitio estatico listo: ${path.join(distDir, "index.html")}`);
}

main().catch((error) => {
  console.error("No se pudo preparar la carpeta dist:", error);
  process.exit(1);
});
