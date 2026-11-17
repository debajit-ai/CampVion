import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const backendDir = path.resolve(frontendDir, "..", "backend");

function resolvePythonExecutable() {
  const candidates = [
    path.join(backendDir, "venv", "Scripts", "python.exe"),
    path.join(backendDir, ".venv", "Scripts", "python.exe"),
    path.join(backendDir, "venv", "bin", "python"),
    path.join(backendDir, ".venv", "bin", "python"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "python";
}

const pythonExe = resolvePythonExecutable();
const result = spawnSync(pythonExe, ["-m", "app.db.seed"], {
  cwd: backendDir,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
