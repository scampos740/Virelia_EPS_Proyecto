import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
async function eventually(fn) {
  for (let i = 0; i < 100; i++) {
    try {
      if (await fn()) return;
    } catch {}
    await delay(100);
  }
  assert.fail("El servicio no llegó al estado esperado");
}
test("caer Citas no detiene gateway ni otros servicios y se reinicia solo", async () => {
  const env = {
    ...process.env,
    INTERNAL_API_KEY: "test-only-internal-secret-at-least-24",
    API_ONLY: "true",
    GATEWAY_PORT: "6100",
    AFILIADOS_PORT: "6101",
    CITAS_PORT: "6102",
    NOTIFICACIONES_PORT: "6104",
    DOCUMENTOS_PORT: "6103",
    SMTP_HOST: "",
    DB_PORT: "1",
  };
  const app = spawn(process.execPath, ["scripts/dev.mjs"], {
    env,
    stdio: "pipe",
  });
  let output = "";
  app.stdout.on("data", (c) => (output += c));
  app.stderr.on("data", () => {});
  const call = (n) =>
    fetch(`http://127.0.0.1:6100/api/${n}/health`, {
      signal: AbortSignal.timeout(2000),
    });
  try {
    await eventually(
      async () =>
        (await call("citas")).status === 200 &&
        (await call("afiliados")).status === 200 &&
        (await call("documentos")).status === 200,
    );
    const pid = Number(
      output.match(
        /Iniciado services\/citas\/src\/server.js \(PID (\d+)\)/,
      )?.[1],
    );
    assert.ok(pid);
    process.kill(pid, "SIGTERM");
    await eventually(async () => (await call("citas")).status === 503);
    assert.equal((await call("afiliados")).status, 200);
    assert.equal((await call("documentos")).status, 200);
    assert.equal(app.exitCode, null);
    await eventually(async () => (await call("citas")).status === 200);
    assert.equal(
      (await fetch("http://127.0.0.1:6100/api/atencion/health")).status,
      404,
    );
  } finally {
    app.kill("SIGTERM");
    await once(app, "exit");
  }
});
