import { spawn } from "node:child_process";
import { names } from "../shared/config.js";
const children = new Set(),
  timers = new Set();
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const timer of timers) clearTimeout(timer);
  for (const child of children) child.kill("SIGTERM");
}
function launch(file, failures = 0) {
  if (stopping) return;
  const vite = file === "vite";
  const child = spawn(
    process.execPath,
    vite ? ["../node_modules/vite/bin/vite.js", "--host", "127.0.0.1"] : [file],
    {
      cwd: new URL(vite ? "../frontend/" : "../", import.meta.url),
      stdio: "inherit",
      env: process.env,
    },
  );
  children.add(child);
  console.log(`Iniciado ${file} (PID ${child.pid})`);
  const started = Date.now();
  child.on("error", () =>
    console.error(`No se pudo iniciar ${file}. Los otros servicios continúan.`),
  );
  child.on("exit", () => {
    children.delete(child);
    if (stopping) return;
    const count = Date.now() - started > 30000 ? 0 : failures + 1;
    const wait = Math.min(30000, 1000 * 2 ** Math.min(count, 5));
    console.error(
      `${file} se detuvo. Reintento en ${wait / 1000}s; los demás procesos siguen activos.`,
    );
    const timer = setTimeout(() => {
      timers.delete(timer);
      launch(file, count);
    }, wait);
    timers.add(timer);
  });
}
for (const file of [
  ...names.map((n) => `services/${n}/src/server.js`),
  "gateway/server.js",
  ...(process.env.API_ONLY === "true" ? [] : ["vite"]),
])
  launch(file);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
