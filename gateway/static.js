import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../frontend/dist", import.meta.url));
export async function staticPage(req, res, url) {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    return res.end();
  }
  try {
    let path = decodeURIComponent(url.pathname);
    if (path.includes("\0")) throw Error();
    if (path.split("/").some((part) => part.startsWith("."))) {
      res.writeHead(404);
      return res.end("Recurso no encontrado.");
    }
    const target = resolve(root, "." + path);
    if (!target.startsWith(root + sep) && target !== root) throw Error();
    const extension = extname(target);
    let data;
    try {
      data = await readFile(extension ? target : resolve(root, "index.html"));
    } catch {
      res.writeHead(404);
      return res.end("Recurso no encontrado.");
    }
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    if (process.env.NODE_ENV === "production")
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    res.setHeader(
      "Content-Type",
      {
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
      }[extension] || "text/html; charset=utf-8",
    );
    res.writeHead(200);
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(400);
    res.end("Solicitud inválida.");
  }
}
