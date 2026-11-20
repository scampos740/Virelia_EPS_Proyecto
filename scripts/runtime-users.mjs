process.on("uncaughtException", (e) => {
  console.error("Operación no completada:", e.code || e.name);
  process.exit(1);
});
import mysql from "mysql2/promise";
import { dbConfig, databaseName, names } from "../shared/config.js";
const c = await mysql.createConnection({
  ...dbConfig,
  user: process.env.DB_ADMIN_USER || "root",
  password: process.env.DB_ADMIN_PASSWORD ?? process.env.MYSQL_ROOT_PASSWORD,
});
try {
  for (const domain of names) {
    const key = domain.toUpperCase(),
      user = process.env[`${key}_DB_USER`],
      pass = process.env[`${key}_DB_PASSWORD`];
    if (!user || !pass)
      throw Error(`Configura ${key}_DB_USER y ${key}_DB_PASSWORD`);
    const account = `${mysql.escape(user)}@'%'`;
    await c.query(
      `CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${mysql.escape(pass)}`,
    );
    for (const n of domain === "afiliados" ? [domain, "atencion"] : [domain]) {
      const schema = databaseName(n);
      const [tables] = await c.execute(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'",
        [schema],
      );
      for (const t of tables) {
        const table = t.TABLE_NAME;
        const perms =
          table === "audit_events"
            ? "SELECT,INSERT"
            : table === "clinical_addenda"
              ? "SELECT,INSERT"
              : table === "clinical_encounters"
                ? "SELECT,INSERT,UPDATE"
                : "SELECT,INSERT,UPDATE,DELETE";
        await c.query(
          `GRANT ${perms} ON \`${schema}\`.\`${table}\` TO ${account}`,
        );
      }
    }
  }
  console.log(
    "Permisos por servicio preparados; sin DDL ni acceso a bases ajenas.",
  );
} finally {
  await c.end();
}
