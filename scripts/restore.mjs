process.on("uncaughtException", (e) => {
  console.error("Operación no completada:", e.code || e.name);
  process.exit(1);
});
import mysql from "mysql2/promise";
import { createDecipheriv, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dbConfig, dbPrefix, domains } from "../shared/config.js";
import { schemas } from "../shared/schema.js";
import { migrate } from "../shared/migrations.js";
const target = process.env.RESTORE_PREFIX,
  pass = process.env.BACKUP_PASSPHRASE;
if (!target || !/^\w+$/.test(target) || target === dbPrefix)
  throw Error(
    "RESTORE_PREFIX debe ser un prefijo nuevo y distinto al activo. No se sobrescriben datos.",
  );
const bytes = await readFile(process.argv[2]);
if (bytes.subarray(0, 4).toString() !== "VIR1")
  throw Error("Formato no válido.");
const dec = createDecipheriv(
  "aes-256-gcm",
  scryptSync(pass, bytes.subarray(4, 20), 32),
  bytes.subarray(20, 32),
);
dec.setAuthTag(bytes.subarray(32, 48));
const backup = JSON.parse(
  Buffer.concat([dec.update(bytes.subarray(48)), dec.final()]).toString(),
);
const c = await mysql.createConnection({
  ...dbConfig,
  user: process.env.DB_ADMIN_USER || dbConfig.user,
  password: process.env.DB_ADMIN_PASSWORD || dbConfig.password,
});
try {
  const [existing] = await c.execute(
    "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME IN (" +
      domains.map(() => "?").join(",") +
      ")",
    domains.map((d) => `${target}_${d}`),
  );
  if (existing.length)
    throw Error(
      "El destino ya existe. Selecciona otro prefijo para evitar sobrescrituras.",
    );
  for (const domain of domains) {
    await c.query(
      `CREATE DATABASE \`${target}_${domain}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await c.query(`USE \`${target}_${domain}\``);
    for (const sql of schemas[domain]) await c.query(sql);
    await migrate(c, domain);
    await c.query("SET FOREIGN_KEY_CHECKS=0");
    for (const [table, records] of Object.entries(
      backup.databases[domain] || {},
    )) {
      if (!/^[a-z_]+$/.test(table)) throw Error("Tabla no válida.");
      for (const record of records) {
        const keys = Object.keys(record);
        if (keys.some((k) => !/^\w+$/.test(k)))
          throw Error("Columna no válida.");
        await c.query(
          `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
          keys.map((k) =>
            typeof record[k] === "object" && record[k] !== null
              ? JSON.stringify(record[k])
              : record[k],
          ),
        );
      }
    }
    await c.query("SET FOREIGN_KEY_CHECKS=1");
  }
  console.log(
    "Restauración terminada en un prefijo nuevo. Verifica relaciones, conteos y flujos antes de cambiar DB_PREFIX.",
  );
} finally {
  await c.end();
}
