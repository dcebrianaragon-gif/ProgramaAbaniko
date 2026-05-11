const { spawn } = require("child_process");
const path = require("path");

const url = "http://127.0.0.1:3000/Index.html";
const root = path.resolve(__dirname, "..");
const command = process.platform === "win32" ? "cmd" : "sh";
const args = process.platform === "win32"
  ? ["/c", "start", "", url]
  : ["-c", `open "${url}" 2>/dev/null || xdg-open "${url}"`];
const firebaseArgs = process.platform === "win32"
  ? ["/c", "start", "", path.join(root, "Abrir Firebase Si Hace Falta.bat")]
  : ["-c", `npx firebase-tools deploy --only firestore:rules --project programaabaniko --non-interactive >/dev/null 2>&1 &`];

setTimeout(() => {
  spawn(command, args, {
    detached: true,
    stdio: "ignore",
    shell: false
  }).unref();

  spawn(command, firebaseArgs, {
    detached: true,
    stdio: "ignore",
    shell: false
  }).unref();
}, 1200);
