import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
try {
  loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
export const names = ["afiliados", "citas", "documentos", "notificaciones"];
export const domains = [...names, "atencion"]; // Datos históricos de PQRS; atendidos por Afiliados.
export const ports = Object.fromEntries(
  names.map((n) => [
    n,
    Number(
      process.env[`${n.toUpperCase()}_PORT`] ||
        {
          afiliados: 3001,
          citas: 3002,
          notificaciones: 3004,
          documentos: 3003,
        }[n],
    ),
  ]),
);
export const internalKey = process.env.INTERNAL_API_KEY || "";
export const host = process.env.HOST || "127.0.0.1";
export const dbPrefix = process.env.DB_PREFIX || "virelia";
if (!/^[a-zA-Z0-9_]+$/.test(dbPrefix))
  throw new Error("DB_PREFIX solo admite letras, números y guion bajo.");
export const databaseName = (n) => `${dbPrefix}_${n}`;
export const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "virelia_app",
  password: process.env.DB_PASSWORD || "",
  charset: "utf8mb4",
  timezone: "+00:00",
  ...(process.env.DB_TLS === "true"
    ? {
        ssl: {
          rejectUnauthorized: true,
          ...(process.env.DB_CA_FILE
            ? { ca: readFileSync(process.env.DB_CA_FILE) }
            : {}),
        },
      }
    : {}),
  dateStrings: true,
  connectionLimit: 5,
  connectTimeout: 5000,
  waitForConnections: true,
  queueLimit: 20,
};

import { validateProduction } from "./production.js";
validateProduction();
const site = new URL(process.env.PUBLIC_APP_URL || "http://127.0.0.1:5173");
if (!["http:", "https:"].includes(site.protocol))
  throw new Error("PUBLIC_APP_URL requiere HTTP o HTTPS.");
export const publicOrigin = site.origin;
