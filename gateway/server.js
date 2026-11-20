import { createServer, request } from "node:http";
import { ports, host } from "../shared/config.js";
import { setSecurityHeaders } from "../shared/headers.js";
import { staticPage } from "./static.js";
const port = Number(process.env.GATEWAY_PORT || 3000);
createServer((req, res) => {
  const u = new URL(req.url, "http://localhost"),
    p = u.pathname.split("/"),
    n = p[2];
  const started = Date.now();
  res.on("finish", () => {
    if (res.statusCode >= 500)
      console.warn(
        JSON.stringify({
          event: "http.failure",
          service: ports[n] ? n : "gateway",
          status: res.statusCode,
          method: req.method,
          durationMs: Date.now() - started,
        }),
      );
  });
  res.setHeader("Cache-Control", "no-store");
  setSecurityHeaders(res);
  if (u.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ data: { status: "ok" } }));
  }
  if (p[1] !== "api" && process.env.SERVE_FRONTEND === "true")
    return staticPage(req, res, u);
  if (p[1] !== "api" || !ports[n] || u.pathname.includes("_internal")) {
    res.writeHead(404);
    return res.end(
      JSON.stringify({ error: { message: "Ruta no encontrada." } }),
    );
  }
  const headers = { ...req.headers };
  delete headers["x-internal-key"];
  delete headers["x-user-id"];
  const upstream = request(
    {
      hostname: "127.0.0.1",
      port: ports[n],
      method: req.method,
      path: "/" + p.slice(3).join("/") + u.search,
      headers,
      timeout: 10000,
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.on("error", () => res.destroy());
      response.pipe(res);
    },
  );
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => {
    if (!res.headersSent)
      res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: {
          message: "Este servicio no está disponible. Intenta de nuevo.",
        },
      }),
    );
  });
  req.on("aborted", () => upstream.destroy());
  res.on("close", () => {
    if (!res.writableEnded) upstream.destroy();
  });
  req.pipe(upstream);
}).listen(port, process.env.GATEWAY_HOST || host, () =>
  console.log(`API: http://${host}:${port}`),
);
