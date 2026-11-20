import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { randomUUID, randomInt } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import mysql from "mysql2/promise";
import { dbConfig } from "../shared/config.js";
import { tokenHash, hashPassword } from "../shared/security.js";

const prefix = `${process.env.DB_PREFIX || "virelia"}_integration`;
const env = {
  ...process.env,
  DB_PREFIX: prefix,
  API_ONLY: "true",
  EMAIL_LOGIN_OTP: "false",
  GATEWAY_PORT: "4200",
  AFILIADOS_PORT: "4201",
  CITAS_PORT: "4202",
  NOTIFICACIONES_PORT: "4204",
  DOCUMENTOS_PORT: "4203",
  SMTP_HOST: "127.0.0.1",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  SMTP_SECURE: "false",
  SMTP_POLL_MS: "200",
  REQUIRE_EMAIL_VERIFICATION: "true",
  MAIL_FROM: "Virelia <local@example.test>",
  PUBLIC_APP_URL: "http://127.0.0.1:5173",
};
const base = "http://127.0.0.1:4200/api";
const messages = [],
  sockets = new Set();
let app, smtp, users, notifications, fixture, fixturePassword, account, token;
async function call(service, path, { method = "GET", body, cookie } = {}) {
  const r = await fetch(`${base}/${service}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000),
  });
  return {
    status: r.status,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    body: await r.json(),
  };
}
async function waitFor(check) {
  for (let i = 0; i < 100; i++) {
    const value = await check();
    if (value) return value;
    await delay(100);
  }
  assert.fail("No llegó el resultado esperado en el SMTP local o en la API.");
}
async function init() {
  const child = spawn(process.execPath, ["scripts/init-db.mjs"], {
    env,
    stdio: "pipe",
  });
  let error = "";
  child.stderr.on("data", (c) => (error += c));
  assert.equal((await once(child, "exit"))[0], 0, error);
}
function decoded(message) {
  return message
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}
async function linkFor(email, afterIndex = 0) {
  return waitFor(() => {
    const mail = messages
      .slice(afterIndex)
      .find(
        (m) =>
          m.includes(`To: ${email}`) && decoded(m).includes("verificar?token="),
      );
    return mail && decoded(mail).match(/verificar\?token=([0-9a-f]{64})/)?.[1];
  });
}
async function register() {
  const id = randomUUID(),
    email = `verify-${id}@example.test`;
  const result = await call("afiliados", "/registro", {
    method: "POST",
    body: {
      email,
      password: "Prueba123!",
      nombres: "Persona",
      apellidos: "Ficticia",
      tipoDocumento: "CC",
      documento: String(randomInt(100000000, 9999999999)),
      nacimiento: "1995-05-12",
      telefono: "3001234567",
      direccion: "Calle de ejemplo 10",
      ciudad: "Bogotá",
      consentimiento: true,
    },
  });
  assert.equal(result.status, 201);
  return { email, result };
}
before(async () => {
  smtp = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 local.test ESMTP ready\r\n");
    let buffer = "",
      data = false,
      message = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === ".") {
            messages.push(message);
            message = "";
            data = false;
            socket.write("250 accepted\r\n");
          } else message += line + "\n";
        } else if (/^(EHLO|HELO)/.test(line))
          socket.write("250-local.test\r\n250 PIPELINING\r\n");
        else if (/^DATA/.test(line)) {
          data = true;
          socket.write("354 send data\r\n");
        } else if (/^QUIT/.test(line)) socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
  });
  smtp.listen(0, "127.0.0.1");
  await once(smtp, "listening");
  env.SMTP_PORT = String(smtp.address().port);
  await init();
  users = await mysql.createConnection({
    ...dbConfig,
    database: `${prefix}_afiliados`,
  });
  notifications = await mysql.createConnection({
    ...dbConfig,
    database: `${prefix}_notificaciones`,
  });
  fixture = randomUUID();
  fixturePassword = hashPassword("Conservar123!");
  await users.execute(
    "INSERT INTO users(id,email,password_hash,nombres,apellidos,tipo_documento,documento,nacimiento,telefono,direccion,ciudad) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    [
      fixture,
      `${fixture}@example.test`,
      fixturePassword,
      "Anterior",
      "Ficticia",
      "CC",
      fixture.slice(0, 25),
      "1995-05-12",
      "3001234567",
      "Ejemplo",
      "Bogotá",
    ],
  );
  await users.query("ALTER TABLE users DROP COLUMN email_verified");
  await notifications.query(
    "ALTER TABLE notifications DROP COLUMN email_text, DROP COLUMN email_kind",
  );
  await init();
  await init();
  await seedAuthorizedSchedules(env);
  app = spawn(process.execPath, ["scripts/dev.mjs"], { env, stdio: "pipe" });
  let log = "";
  app.stderr.on("data", (c) => (log += c));
  await waitFor(async () => {
    if (app.exitCode !== null) assert.fail(log);
    try {
      return (
        await Promise.all(
          ["afiliados", "citas", "notificaciones", "documentos"].map((s) =>
            call(s, "/health"),
          ),
        )
      ).every((r) => r.status === 200);
    } catch {
      return false;
    }
  });
});
after(async () => {
  if (app && app.exitCode === null) {
    app.kill("SIGTERM");
    await once(app, "exit");
  }
  for (const socket of sockets) socket.destroy();
  if (smtp?.listening) await new Promise((resolve) => smtp.close(resolve));
  await users?.end();
  await notifications?.end();
});
test("la migración añade columnas dos veces sin perder cuentas anteriores", async () => {
  const [[row]] = await users.execute("SELECT * FROM users WHERE id=?", [
    fixture,
  ]);
  assert.equal(row.password_hash, fixturePassword);
  assert.equal(row.email_verified, 0);
  const [columns] = await notifications.query(
    "SHOW COLUMNS FROM notifications",
  );
  assert.ok(columns.some((c) => c.Field === "email_text"));
  assert.ok(columns.some((c) => c.Field === "email_kind"));
});
test("registro envía enlace por SMTP, guarda su hash y bloquea acceso sin verificar", async () => {
  account = await register();
  assert.equal(account.result.body.data.verificationRequired, true);
  assert.equal(account.result.cookie, undefined);
  const login = await call("afiliados", "/login", {
    method: "POST",
    body: { email: account.email, password: "Prueba123!" },
  });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, "EMAIL_NOT_VERIFIED");
  token = await linkFor(account.email);
  const [[verification]] = await users.execute(
    "SELECT * FROM email_verifications WHERE token_hash=?",
    [tokenHash(token)],
  );
  assert.ok(verification);
  assert.notEqual(verification.token_hash, token);
  account.id = verification.user_id;
  const [[notice]] = await notifications.execute(
    "SELECT mensaje FROM notifications WHERE user_id=?",
    [account.id],
  );
  assert.ok(!notice.mensaje.includes(token));
});
test("confirmar verifica la cuenta, permite ingresar y rechaza reutilizar el enlace", async () => {
  const confirm = (value) =>
    call("afiliados", "/verificacion/confirmar", {
      method: "POST",
      body: { token: value },
    });
  assert.equal((await confirm("invalido")).status, 400);
  assert.equal((await confirm(token)).status, 200);
  assert.equal((await confirm(token)).status, 400);
  const login = await call("afiliados", "/login", {
    method: "POST",
    body: { email: account.email, password: "Prueba123!" },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.emailVerified, true);
  account.cookie = login.cookie;
  assert.ok(account.cookie);
  await waitFor(async () => {
    const [[row]] = await notifications.execute(
      "SELECT email_text,email_status FROM notifications WHERE user_id=?",
      [account.id],
    );
    return row?.email_status === "Enviado" && row.email_text === null;
  });
});
test("enlace vencido se rechaza y reenvío respeta límites y privacidad", async () => {
  const pending = await register(),
    first = await linkFor(pending.email);
  await users.execute(
    "UPDATE email_verifications SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE token_hash=?",
    [tokenHash(first)],
  );
  assert.equal(
    (
      await call("afiliados", "/verificacion/confirmar", {
        method: "POST",
        body: { token: first },
      })
    ).status,
    400,
  );
  const start = messages.length;
  const resend = await call("afiliados", "/verificacion/reenviar", {
    method: "POST",
    body: { email: pending.email },
  });
  assert.equal(resend.status, 200);
  const next = await linkFor(pending.email, start);
  assert.notEqual(next, first);
  assert.equal(
    (
      await call("afiliados", "/verificacion/confirmar", {
        method: "POST",
        body: { token: next },
      })
    ).status,
    200,
  );
  const unknown = `unknown-${randomUUID()}@example.test`;
  for (let i = 0; i < 3; i++) {
    const r = await call("afiliados", "/verificacion/reenviar", {
      method: "POST",
      body: { email: unknown },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.message, resend.body.data.message);
  }
  assert.equal(
    (
      await call("afiliados", "/verificacion/reenviar", {
        method: "POST",
        body: { email: unknown },
      })
    ).status,
    429,
  );
});
test("una cita genera aviso propio y correo sin datos sensibles de atención", async () => {
  const slots = (
    await call("citas", "/disponibilidad", { cookie: account.cookie })
  ).body.data;
  const slot = slots[0],
    start = messages.length;
  assert.equal(
    (
      await call("citas", "/", {
        method: "POST",
        cookie: account.cookie,
        body: { slotId: slot.id },
      })
    ).status,
    201,
  );
  const mail = await waitFor(() =>
    messages
      .slice(start)
      .find(
        (m) =>
          m.includes(`To: ${account.email}`) &&
          Buffer.from(decoded(m), "binary")
            .toString("utf8")
            .includes("actualización de tu cita"),
      ),
  );
  const text = Buffer.from(decoded(mail), "binary").toString("utf8");
  for (const value of [
    slot.especialidad,
    slot.fecha,
    slot.hora,
    slot.profesional,
    slot.sede,
  ])
    assert.ok(!text.includes(value), value);
  const notices = (
    await call("notificaciones", "/", { cookie: account.cookie })
  ).body.data;
  assert.ok(notices.some((n) => n.titulo === "Cita agendada"));
});
test("los cambios de citas y verificación se envían aunque otros avisos estén desactivados", async () => {
  await call("notificaciones", "/preferencias", {
    method: "PATCH",
    cookie: account.cookie,
    body: { emailEnabled: false },
  });
  const slot = (
    await call("citas", "/disponibilidad", { cookie: account.cookie })
  ).body.data[0];
  const start = messages.length;
  await call("citas", "/", {
    method: "POST",
    cookie: account.cookie,
    body: { slotId: slot.id },
  });
  await waitFor(async () =>
    (
      await call("notificaciones", "/", { cookie: account.cookie })
    ).body.data.some(
      (n) => n.titulo === "Cita agendada" && n.email_status === "Enviado",
    ),
  );
  await waitFor(() =>
    messages.slice(start).some((m) => m.includes(`To: ${account.email}`)),
  );
  const pending = await register(),
    original = await linkFor(pending.email);
  const [[v]] = await users.execute(
    "SELECT user_id FROM email_verifications WHERE token_hash=?",
    [tokenHash(original)],
  );
  await notifications.execute(
    "INSERT INTO preferences(user_id,email_enabled)VALUES(?,0)",
    [v.user_id],
  );
  const from = messages.length;
  await call("afiliados", "/verificacion/reenviar", {
    method: "POST",
    body: { email: pending.email },
  });
  assert.ok(await linkFor(pending.email, from));
});
async function latestCode(email, from) {
  return waitFor(() => {
    const m = messages
      .slice(from)
      .find(
        (m) => m.includes(`To: ${email}`) && decoded(m).includes("Virelia es:"),
      );
    return m && decoded(m).match(/Virelia es: (\d{6})/)?.[1];
  });
}
async function passwordStep(email = account.email) {
  const from = messages.length;
  const result = await call("afiliados", "/login", {
    method: "POST",
    body: { email, password: "Prueba123!" },
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.loginCodeRequired, true);
  assert.ok(result.cookie.startsWith("virelia_login="));
  const code = await latestCode(email, from);
  return { result, code };
}
const finishStep = (step, code = step.code, cookie = step.result.cookie) =>
  call("afiliados", "/login/confirmar", {
    method: "POST",
    cookie,
    body: { challengeId: step.result.body.data.challengeId, code },
  });
test("reserva, reprogramación y cancelación producen un correo cada una", async () => {
  const slot = (
    await call("citas", "/disponibilidad", { cookie: account.cookie })
  ).body.data[0];
  let from = messages.length;
  const booked = await call("citas", "/", {
    method: "POST",
    cookie: account.cookie,
    body: { slotId: slot.id },
  });
  assert.equal(booked.status, 201);
  await waitFor(() =>
    messages
      .slice(from)
      .some(
        (m) =>
          m.includes(`To: ${account.email}`) &&
          decoded(m).includes("Cita agendada."),
      ),
  );
  const next = (
    await call("citas", "/disponibilidad", { cookie: account.cookie })
  ).body.data[0];
  from = messages.length;
  assert.equal(
    (
      await call("citas", `/${booked.body.data.id}/reagendar`, {
        method: "PATCH",
        cookie: account.cookie,
        body: { slotId: next.id },
      })
    ).status,
    200,
  );
  await waitFor(() =>
    messages
      .slice(from)
      .some(
        (m) =>
          m.includes(`To: ${account.email}`) &&
          decoded(m).includes("Cita reprogramada."),
      ),
  );
  from = messages.length;
  assert.equal(
    (
      await call("citas", `/${booked.body.data.id}/cancelar`, {
        method: "PATCH",
        cookie: account.cookie,
        body: {},
      })
    ).status,
    200,
  );
  await waitFor(() =>
    messages
      .slice(from)
      .some(
        (m) =>
          m.includes(`To: ${account.email}`) &&
          decoded(m).includes("Cita cancelada."),
      ),
  );
});
test("dos pasos: contraseña sola no abre sesión; código en el mismo navegador sí, una sola vez", async () => {
  app.kill("SIGTERM");
  await once(app, "exit");
  env.EMAIL_LOGIN_OTP = "true";
  await seedAuthorizedSchedules(env);
  app = spawn(process.execPath, ["scripts/dev.mjs"], { env, stdio: "pipe" });
  app.stderr.on("data", () => {});
  app.stdout.on("data", () => {});
  await waitFor(async () => {
    try {
      return (await call("afiliados", "/health")).status === 200;
    } catch {
      return false;
    }
  });
  const step = await passwordStep();
  assert.equal(
    (await call("afiliados", "/me", { cookie: step.result.cookie })).status,
    401,
  );
  assert.equal(
    (await finishStep(step, step.code, "virelia_login=otro-navegador")).status,
    400,
  );
  const [[row]] = await users.execute(
    "SELECT * FROM login_challenges WHERE id_hash=?",
    [tokenHash(step.result.body.data.challengeId)],
  );
  assert.notEqual(row.code_hash, step.code);
  assert.equal(row.attempts, 0);
  const confirmed = await finishStep(step);
  assert.equal(confirmed.status, 200);
  assert.ok(confirmed.cookie.startsWith("virelia_session="));
  assert.equal(
    (await call("afiliados", "/me", { cookie: confirmed.cookie })).status,
    200,
  );
  assert.equal((await finishStep(step)).status, 400);
});
test("dos pasos: reenvío limita frecuencia, sustituye el código anterior y conserva intentos", async () => {
  const step = await passwordStep();
  assert.equal(
    (
      await call("afiliados", "/login/reenviar", {
        method: "POST",
        cookie: step.result.cookie,
        body: { challengeId: step.result.body.data.challengeId },
      })
    ).status,
    429,
  );
  await users.execute(
    "UPDATE login_challenges SET last_sent_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 61 SECOND) WHERE id_hash=?",
    [tokenHash(step.result.body.data.challengeId)],
  );
  const from = messages.length;
  assert.equal(
    (
      await call("afiliados", "/login/reenviar", {
        method: "POST",
        cookie: step.result.cookie,
        body: { challengeId: step.result.body.data.challengeId },
      })
    ).status,
    200,
  );
  const newest = await latestCode(account.email, from);
  if (newest !== step.code) assert.equal((await finishStep(step)).status, 400);
  assert.equal((await finishStep(step, newest)).status, 200);
});
test("dos pasos: cinco intentos erróneos quedan bloqueados de forma persistente", async () => {
  const step = await passwordStep();
  const wrong = step.code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++)
    assert.equal((await finishStep(step, wrong)).status, i === 4 ? 429 : 400);
  assert.equal((await finishStep(step)).status, 429);
  const [[row]] = await users.execute(
    "SELECT attempts FROM login_challenges WHERE id_hash=?",
    [tokenHash(step.result.body.data.challengeId)],
  );
  assert.equal(row.attempts, 5);
  assert.equal(
    (
      await call("afiliados", "/login", {
        method: "POST",
        body: { email: account.email, password: "Prueba123!" },
      })
    ).status,
    429,
  );
});
test("dos pasos: expiración y rol doctor requieren el código sin exenciones", async () => {
  const id = randomUUID(),
    email = `doctor-code-${id}@example.test`;
  await users.execute(
    "INSERT INTO users(id,email,password_hash,email_verified,role,nombres,apellidos,tipo_documento,documento,nacimiento,telefono,direccion,ciudad)VALUES(?,?,?,1,'doctor','Laura','Prueba','CC',?,'1990-01-01','3001234567','Calle 10','Bogotá')",
    [
      id,
      email,
      hashPassword("Prueba123!"),
      String(randomInt(1000000000, 9999999999)),
    ],
  );
  const expired = await passwordStep(email);
  await users.execute(
    "UPDATE login_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id_hash=?",
    [tokenHash(expired.result.body.data.challengeId)],
  );
  assert.equal((await finishStep(expired)).status, 400);
  const current = await passwordStep(email);
  const result = await finishStep(current);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.role, "doctor");
});

async function seedAuthorizedSchedules(config) {
  const mysql = await import("mysql2/promise"),
    { dbConfig } = await import("../shared/config.js"),
    { hashPassword } = await import("../shared/security.js");
  const c = await mysql.default.createConnection({
    ...dbConfig,
    database: config.DB_PREFIX + "_citas",
  });
  const [names] = await c.query(
    "SELECT DISTINCT profesional FROM slots WHERE doctor_id IS NULL",
  );
  for (const [i, row] of names.entries()) {
    const id = randomUUID();
    await c.query(
      `INSERT INTO \`${config.DB_PREFIX}_afiliados\`.users(id,email,password_hash,nombres,apellidos,tipo_documento,documento,nacimiento,telefono,direccion,ciudad,role,email_verified,specialty) VALUES(?,?,?,?,?,'CC',?,'1980-01-01','3001234567','Calle 10','Bogotá','doctor',1,'Medicina general')`,
      [
        id,
        `${id}@example.test`,
        hashPassword("Testing123!"),
        "Profesional",
        "Autorizado",
        String(randomInt(100000000, 9999999999)),
      ],
    );
    await c.execute(
      "UPDATE slots SET doctor_id=? WHERE doctor_id IS NULL AND profesional=?",
      [id, row.profesional],
    );
  }
  await c.end();
}

test("recuperación: respuesta genérica, SMTP, hash, uso único y revocación de sesiones", async () => {
  const mail = account.email;
  const login = await call("afiliados", "/login", {
    method: "POST",
    body: { email: mail, password: "Prueba123!" },
  });
  // OTP may be enabled by preceding tests; seed an explicit old session for revocation check.
  const oldToken = "c".repeat(64),
    [[u]] = await users.execute("SELECT id FROM users WHERE email=?", [mail]);
  await users.execute(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
    [tokenHash(oldToken), u.id],
  );
  const first = messages.length;
  const known = await call("afiliados", "/recuperacion/solicitar", {
      method: "POST",
      body: { email: mail },
    }),
    unknown = await call("afiliados", "/recuperacion/solicitar", {
      method: "POST",
      body: { email: `unknown-${randomUUID()}@example.test` },
    });
  assert.equal(known.status, 200);
  assert.deepEqual(known.body, unknown.body);
  const token = await waitFor(
    () =>
      messages
        .slice(first)
        .map(decoded)
        .find((m) => m.includes("restablecer?token="))
        ?.match(/restablecer\?token=([a-f0-9]{64})/)?.[1],
  );
  const [[stored]] = await users.execute(
    "SELECT token_hash FROM password_resets WHERE user_id=? AND used_at IS NULL",
    [u.id],
  );
  assert.equal(stored.token_hash, tokenHash(token));
  assert.notEqual(stored.token_hash, token);
  const reset = () =>
    call("afiliados", "/recuperacion/confirmar", {
      method: "POST",
      body: {
        token,
        password: "NuevaSegura123!",
        confirmPassword: "NuevaSegura123!",
      },
    });
  assert.equal((await reset()).status, 200);
  assert.equal((await reset()).status, 400);
  assert.equal(
    (await call("afiliados", "/me", { cookie: `virelia_session=${oldToken}` }))
      .status,
    401,
  );
  const { verifyPassword } = await import("../shared/security.js");
  const [[changed]] = await users.execute(
    "SELECT password_hash FROM users WHERE id=?",
    [u.id],
  );
  assert.ok(verifyPassword("NuevaSegura123!", changed.password_hash));
  assert.ok(!verifyPassword("Prueba123!", changed.password_hash));
});
test("recuperación: enlace vencido, inválido, confirmación distinta y límite persistente", async () => {
  const [[u]] = await users.execute("SELECT id FROM users LIMIT 1");
  const token = "e".repeat(64);
  await users.execute(
    "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND))",
    [tokenHash(token), u.id],
  );
  for (const body of [
    { token, password: "Segura123!", confirmPassword: "Segura123!" },
    { token: "bad", password: "Segura123!", confirmPassword: "Segura123!" },
    { token, password: "Segura123!", confirmPassword: "Otra123!" },
  ])
    assert.equal(
      (
        await call("afiliados", "/recuperacion/confirmar", {
          method: "POST",
          body,
        })
      ).status,
      400,
    );
  const email = `rate-${randomUUID()}@example.test`;
  for (let i = 0; i < 3; i++)
    assert.equal(
      (
        await call("afiliados", "/recuperacion/solicitar", {
          method: "POST",
          body: { email },
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await call("afiliados", "/recuperacion/solicitar", {
        method: "POST",
        body: { email },
      })
    ).status,
    429,
  );
});
