import { test } from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dbConfig } from "../shared/config.js";
const prefix = (process.env.DB_PREFIX || "virelia") + "_ops",
  env = {
    ...process.env,
    DB_PREFIX: prefix,
    SEED_DEMO: "false",
    DB_ADMIN_USER: dbConfig.user,
    DB_ADMIN_PASSWORD: dbConfig.password,
    BACKUP_PASSPHRASE: randomUUID() + randomUUID(),
  };
async function command(file, args = [], extra = {}) {
  const p = spawn(process.execPath, [file, ...args], {
    env: { ...env, ...extra },
    stdio: "pipe",
  });
  let log = "";
  p.stdout.on("data", (c) => (log += c));
  p.stderr.on("data", (c) => (log += c));
  return { code: (await once(p, "exit"))[0], log };
}
test("respaldo cifrado, restauración aislada y permisos mínimos por servicio", async () => {
  assert.equal((await command("scripts/init-db.mjs")).code, 0);
  const admin = await mysql.createConnection(dbConfig),
    folder = await mkdtemp(join(tmpdir(), "virelia-backup-")),
    path = join(folder, "backup.enc");
  try {
    const id = randomUUID();
    await admin.execute(
      `INSERT INTO \`${prefix}_atencion\`.cases(id,user_id,radicado,tipo,asunto,descripcion)VALUES(?,?,?,'Petición','Solicitud conservada','Descripción de prueba aislada')`,
      [id, id, id],
    );
    const backup = await command("scripts/backup.mjs", [path]);
    assert.equal(backup.code, 0, backup.log);
    const bytes = await readFile(path);
    assert.ok(!bytes.includes(Buffer.from("Solicitud conservada")));
    assert.equal(bytes.subarray(0, 4).toString(), "VIR1");
    assert.equal(
      (await command("scripts/restore.mjs", [path], { RESTORE_PREFIX: prefix }))
        .code,
      1,
    );
    const restored = prefix + "_restored";
    const result = await command("scripts/restore.mjs", [path], {
      RESTORE_PREFIX: restored,
    });
    assert.equal(result.code, 0, result.log);
    const [[row]] = await admin.execute(
      `SELECT asunto FROM \`${restored}_atencion\`.cases WHERE id=?`,
      [id],
    );
    assert.equal(row.asunto, "Solicitud conservada");
    const wrong = await command("scripts/restore.mjs", [path], {
      RESTORE_PREFIX: prefix + "_wrong",
      BACKUP_PASSPHRASE: randomUUID(),
    });
    assert.equal(wrong.code, 1);
    const passwords = {};
    const accountPrefix = "qa_" + randomUUID().slice(0, 6) + "_";
    for (const name of ["afiliados", "citas", "documentos", "notificaciones"]) {
      passwords[name] = randomUUID();
      env[name.toUpperCase() + "_DB_USER"] = accountPrefix + name;
      env[name.toUpperCase() + "_DB_PASSWORD"] = passwords[name];
    }
    const grants = await command("scripts/runtime-users.mjs");
    assert.equal(grants.code, 0, grants.log);
    const limited = await mysql.createConnection({
      ...dbConfig,
      user: accountPrefix + "citas",
      password: passwords.citas,
      database: prefix + "_citas",
    });
    try {
      await limited.execute("SELECT COUNT(*) FROM appointments");
      await assert.rejects(() =>
        limited.execute(`SELECT * FROM \`${prefix}_afiliados\`.users`),
      );
      await assert.rejects(() =>
        limited.query("CREATE TABLE forbidden(id INT)"),
      );
      await assert.rejects(() => limited.query("DELETE FROM audit_events"));
    } finally {
      await limited.end();
    }
    // Runtime users intentionally left in ephemeral QA server; no live users changed.
  } finally {
    await admin.end();
  }
});
