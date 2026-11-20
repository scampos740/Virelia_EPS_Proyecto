process.on("uncaughtException", (e) => {
  console.error("Operación no completada:", e.code || e.name);
  process.exit(1);
});
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { dbConfig, domains, databaseName } from "../shared/config.js";
import { migrate } from "../shared/migrations.js";
import { schemas } from "../shared/schema.js";
import { hashPassword } from "../shared/security.js";
const c = await mysql.createConnection({
  ...dbConfig,
  user: process.env.DB_ADMIN_USER || dbConfig.user,
  password: process.env.DB_ADMIN_PASSWORD ?? dbConfig.password,
});
try {
  for (const n of domains) {
    await c.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName(n)}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await c.query(`USE \`${databaseName(n)}\``);
    for (const sql of schemas[n]) await c.query(sql);
    try {
      await migrate(c, n);
    } catch (error) {
      // Con binlog activo, MySQL puede exigir privilegios administrativos para
      // crear triggers. Usa root solo para esta migración local, sin cambiar
      // privilegios del usuario de la aplicación ni opciones globales de MySQL.
      if (
        error.code !== "ER_BINLOG_CREATE_ROUTINE_NEED_SUPER" ||
        process.env.NODE_ENV === "production" ||
        process.env.DB_ADMIN_USER ||
        !process.env.MYSQL_ROOT_PASSWORD
      )
        throw error;
      const operator = await mysql.createConnection({
        ...dbConfig,
        user: "root",
        password: process.env.MYSQL_ROOT_PASSWORD,
      });
      try {
        await operator.query(`USE \`${databaseName(n)}\``);
        await migrate(operator, n);
        console.log(
          "Controles de integridad creados mediante el operador local; usuario de aplicación conservado.",
        );
      } finally {
        await operator.end();
      }
    }
  }
  await c.query(`USE \`${databaseName("citas")}\``);
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.SEED_DEMO === "true"
  ) {
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + i);
      for (const [sp, dr, place] of [
        ["Medicina general", "Dra. Laura Gómez", "Centro Virelia Norte"],
        ["Odontología", "Dr. Carlos Ríos", "Centro Virelia Centro"],
        ["Psicología", "Dra. Sara López", "Atención virtual"],
      ]) {
        for (const h of ["08:00", "09:30", "11:00", "14:30"]) {
          const fecha = d.toISOString().slice(0, 10);
          const [existing] = await c.execute(
            "SELECT id FROM slots WHERE doctor_id IS NULL AND profesional=? AND fecha=? AND hora=?",
            [dr, fecha, h],
          );
          if (!existing.length)
            await c.execute(
              "INSERT INTO slots(id,especialidad,profesional,sede,fecha,hora)VALUES(?,?,?,?,?,?)",
              [randomUUID(), sp, dr, place, fecha, h],
            );
        }
      }
    }
  }
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.SEED_DEMO === "true"
  ) {
    await c.query(`USE \`${databaseName("afiliados")}\``);
    const email = process.env.DEMO_EMAIL || "demo@virelia.test";
    const [exists] = await c.execute("SELECT id FROM users WHERE email=?", [
      email,
    ]);
    if (!exists.length)
      await c.execute(
        "INSERT INTO users(id,email,password_hash,nombres,apellidos,tipo_documento,documento,nacimiento,telefono,direccion,ciudad)VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          email,
          hashPassword(process.env.DEMO_PASSWORD || "Virelia2026!"),
          "Mariana",
          "Torres",
          "CC",
          "DEMO10001",
          "1995-05-12",
          "3001234567",
          "Calle de ejemplo 10",
          "Medellín",
        ],
      );
    await c.execute(
      "UPDATE users SET email_verified=1 WHERE email=? AND documento='DEMO10001'",
      [email],
    );
  }
  console.log("Cuatro bases listas; datos existentes conservados.");
} finally {
  await c.end();
}
