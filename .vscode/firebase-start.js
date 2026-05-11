const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const command = isWindows ? "cmd" : "sh";
const deployArgs = isWindows
  ? ["/c", "npx", "firebase-tools", "deploy", "--only", "firestore:rules", "--project", "programaabaniko", "--non-interactive"]
  : ["-c", "npx firebase-tools deploy --only firestore:rules --project programaabaniko --non-interactive"];

const deploy = spawn(command, deployArgs, {
  cwd: root,
  detached: true,
  stdio: "ignore",
  shell: false
});

deploy.unref();
