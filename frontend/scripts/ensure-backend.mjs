import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const backendDir = path.resolve(frontendDir, "..", "backend");
const HEALTH_URL = "http://127.0.0.1:8000/api/health";

async function isBackendHealthy() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

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

async function main() {
  if (await isBackendHealthy()) {
    console.log("[CampVion] FastAPI backend is active at http://127.0.0.1:8000/api");
    return;
  }

  if (!fs.existsSync(backendDir)) {
    return;
  }

  const pythonExe = resolvePythonExecutable();
  console.log("[CampVion] Starting FastAPI backend on http://127.0.0.1:8000...");

  const child = spawn(
    pythonExe,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    {
      cwd: backendDir,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }
  );
  child.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isBackendHealthy()) {
      console.log("[CampVion] FastAPI backend is online and ready at http://127.0.0.1:8000/api");
      return;
    }
  }

  console.warn(
    "[CampVion] Notice: FastAPI backend did not respond within 10s; continuing frontend startup."
  );
}

main().catch(() => {
  process.exit(0);
});

