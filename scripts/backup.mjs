process.on("uncaughtException", (e) => {
  console.error("Operación no completada:", e.code || e.name);
  process.exit(1);
});
import mysql from "mysql2/promise";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dbConfig, domains, databaseName } from "../shared/config.js";
const pass = process.env.BACKUP_PASSPHRASE;
if (!pass || pass.length < 20)
  throw Error(
    "Configura BACKUP_PASSPHRASE de al menos 20 caracteres por un canal privado.",
  );
const c = await mysql.createConnection({
  ...dbConfig,
  user: process.env.DB_ADMIN_USER || dbConfig.user,
  password: process.env.DB_ADMIN_PASSWORD || dbConfig.password,
});
try {
  await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await c.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
  const data = {
    format: 1,
    createdAt: new Date().toISOString(),
    databases: {},
  };
  for (const domain of domains) {
    const schema = databaseName(domain),
      [tables] = await c.execute(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'",
        [schema],
      );
    data.databases[domain] = {};
    for (const t of tables) {
      const name = t.TABLE_NAME;
      const [records] = await c.query(
        `SELECT * FROM \`${schema}\`.\`${name}\``,
      );
      data.databases[domain][name] = records;
    }
  }
  await c.commit();
  const salt = randomBytes(16),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", scryptSync(pass, salt, 32), iv),
    encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), "utf8"),
      cipher.final(),
    ]);
  const path = process.argv[2] || `virelia-backup-${Date.now()}.enc`;
  await writeFile(
    path,
    Buffer.concat([
      Buffer.from("VIR1"),
      salt,
      iv,
      cipher.getAuthTag(),
      encrypted,
    ]),
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Respaldo cifrado creado. Conserva la clave separada del archivo.",
  );
} finally {
  await c.end();
}
