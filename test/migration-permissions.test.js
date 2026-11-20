import { test } from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { dbConfig, databaseName, domains } from "../shared/config.js";

test("migración local crea triggers con operador sin conceder SUPER ni cambiar binlog", async () => {
  const admin = await mysql.createConnection(dbConfig),
    suffix = randomUUID().slice(0, 8),
    prefix = "migration_" + suffix,
    user = "migration_" + suffix,
    pass = randomUUID();
  const names = domains.map((n) => prefix + "_" + n);
  try {
    const [[settings]] = await admin.query(
      "SELECT @@GLOBAL.log_bin AS binlog,@@GLOBAL.log_bin_trust_function_creators AS trust",
    );
    assert.equal(settings.binlog, 1, "El caso exige binlog activo");
    assert.equal(settings.trust, 0, "El caso exige la configuración estricta");
    await admin.query(
      `CREATE USER ${mysql.escape(user)}@'%' IDENTIFIED BY ${mysql.escape(pass)}`,
    );
    for (const name of names) {
      await admin.query(`CREATE DATABASE \`${name}\``);
      await admin.query(
        `GRANT ALL PRIVILEGES ON \`${name}\`.* TO ${mysql.escape(user)}@'%'`,
      );
    }
    await admin.query(
      `CREATE TABLE \`${prefix}_citas\`.migration_probe(id INT PRIMARY KEY,label VARCHAR(50))`,
    );
    await admin.query(
      `INSERT INTO \`${prefix}_citas\`.migration_probe VALUES(1,'dato conservado')`,
    );
    const app = await mysql.createConnection({
      ...dbConfig,
      user,
      password: pass,
      database: prefix + "_citas",
    });
    const [before] = await app.query("SHOW GRANTS");
    try {
      await assert.rejects(
        () =>
          app.query(
            "CREATE TRIGGER qa_probe BEFORE INSERT ON migration_probe FOR EACH ROW SET NEW.label=NEW.label",
          ),
        (e) => e.code === "ER_BINLOG_CREATE_ROUTINE_NEED_SUPER",
      );
    } finally {
      await app.end();
    }
    const env = {
      ...process.env,
      DB_PREFIX: prefix,
      DB_USER: user,
      DB_PASSWORD: pass,
      MYSQL_ROOT_PASSWORD: dbConfig.password,
      DB_ADMIN_USER: "",
      DB_ADMIN_PASSWORD: pass,
      SEED_DEMO: "false",
    };
    async function init() {
      const child = spawn(process.execPath, ["scripts/init-db.mjs"], {
        env,
        stdio: "pipe",
      });
      let output = "";
      child.stdout.on("data", (c) => (output += c));
      child.stderr.on("data", (c) => (output += c));
      assert.equal((await once(child, "exit"))[0], 0, output);
      return output;
    }
    assert.match(await init(), /operador local/);
    await init();
    const [[count]] = await admin.execute(
      "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA=?",
      [prefix + "_citas"],
    );
    assert.equal(count.total, 4);
    const [[data]] = await admin.query(
      `SELECT label FROM \`${prefix}_citas\`.migration_probe WHERE id=1`,
    );
    assert.equal(data.label, "dato conservado");
    const [[afterSettings]] = await admin.query(
      "SELECT @@GLOBAL.log_bin_trust_function_creators AS trust",
    );
    assert.equal(afterSettings.trust, settings.trust);
    const appAfter = await mysql.createConnection({
      ...dbConfig,
      user,
      password: pass,
      database: prefix + "_citas",
    });
    try {
      const [after] = await appAfter.query("SHOW GRANTS");
      assert.deepEqual(after, before);
    } finally {
      await appAfter.end();
    }
  } finally {
    await admin.end();
  }
});
