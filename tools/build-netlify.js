const fs = require("fs/promises");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const publicEntries = [
  { source: "index.html", target: "index.html" },
  { source: "index.html", target: "Index.html" },
  { source: "html", target: "html" },
  { source: "css", target: "css" },
  { source: "js", target: "js" },
  { source: "assets", target: "assets" }
];

async function copyRecursive(source, target) {
  const info = await fs.stat(source);
  if (info.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    const entries = await fs.readdir(source);
    await Promise.all(entries.map((entry) => {
      return copyRecursive(path.join(source, entry), path.join(target, entry));
    }));
    return;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  for (const entry of publicEntries) {
    await copyRecursive(
      path.join(rootDir, entry.source),
      path.join(distDir, entry.target)
    );
  }

  console.log(`Build estatico listo: ${distDir}`);
}

main().catch((error) => {
  console.error("No se pudo preparar la carpeta dist:", error);
  process.exit(1);
});
