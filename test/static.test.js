import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
test("gateway compilado sirve rutas internas y protege configuración ante caída parcial", async () => {
  const cwd = process.cwd();
  const env = {
    ...process.env,
    HOST: "127.0.0.1",
    GATEWAY_PORT: "7300",
    SERVE_FRONTEND: "true",
    SMTP_HOST: "",
    INTERNAL_API_KEY: "qa-production-static-server-at-least24",
  };
  const app = spawn(process.execPath, ["gateway/server.js"], {
    cwd,
    env,
    stdio: "pipe",
  });
  let out = "";
  app.stderr.on("data", (c) => (out += c));
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch("http://127.0.0.1:7300/health")).ok) break;
      } catch {}
      await delay(100);
    }
    for (const path of ["/", "/documentos", "/restablecer"]) {
      const r = await fetch("http://127.0.0.1:7300" + path);
      assert.equal(r.status, 200);
      assert.match(await r.text(), /id="root"/);
      assert.match(
        r.headers.get("content-security-policy"),
        /script-src 'self'/,
      );
    }
    assert.equal((await fetch("http://127.0.0.1:7300/.env")).status, 404);
    assert.equal(
      (await fetch("http://127.0.0.1:7300/api/afiliados/_internal/sesion"))
        .status,
      404,
    );
    assert.equal((await fetch("http://127.0.0.1:7300/api/citas/")).status, 503);
    assert.equal((await fetch("http://127.0.0.1:7300/")).status, 200);
    console.log(
      "Gateway compilado: rutas internas, protección .env, API interna y caída parcial verificados.",
    );
  } finally {
    app.kill("SIGTERM");
    await once(app, "exit");
  }
});
