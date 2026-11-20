import { before, after, test } from "node:test";
import { createServer } from "node:net";
import { randomUUID, randomInt } from "node:crypto";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import "../shared/config.js";
const env = {
  ...process.env,
  DB_PREFIX: `${process.env.DB_PREFIX || "virelia"}_integration`,
  GATEWAY_PORT: "4100",
  AFILIADOS_PORT: "4101",
  CITAS_PORT: "4102",
  NOTIFICACIONES_PORT: "4104",
  DOCUMENTOS_PORT: "4103",
  SMTP_HOST: "",
  REQUIRE_EMAIL_VERIFICATION: "false",
  API_ONLY: "true",
  EMAIL_LOGIN_OTP: "false",
};
let app;
const base = "http://127.0.0.1:4100/api";
async function call(
  service,
  path = "/",
  { method = "GET", body, cookie } = {},
) {
  if (service === "atencion") {
    service = "afiliados";
    path = "/pqrs" + (path === "/" ? "" : path);
  }
  const res = await fetch(base + "/" + service + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const isPdf = res.headers.get("content-type")?.includes("application/pdf");
  return {
    status: res.status,
    cookie: res.headers.get("set-cookie")?.split(";")[0],
    body: isPdf ? Buffer.from(await res.arrayBuffer()) : await res.json(),
  };
}
async function register(label) {
  const suffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
  const result = await call("afiliados", "/registro", {
    method: "POST",
    body: {
      email: `${label}${suffix}@example.test`,
      password: "Prueba123!",
      nombres: label,
      apellidos:
        "Prueba " +
        randomUUID()
          .replaceAll("-", "")
          .slice(0, 8)
          .replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)]),
      tipoDocumento: "CC",
      documento: String(randomInt(100000000, 9999999999)),
      nacimiento: "1995-05-12",
      telefono: "3001234567",
      direccion: "Calle ficticia 10",
      ciudad: "Bogotá",
      consentimiento: true,
    },
  });
  assert.equal(result.status, 201);
  return result;
}
before(async () => {
  const init = spawn(process.execPath, ["scripts/init-db.mjs"], {
    env,
    stdio: "pipe",
  });
  let log = "";
  init.stderr.on("data", (c) => (log += c));
  const [code] = await once(init, "exit");
  assert.equal(code, 0, log);
  await seedAuthorizedSchedules(env);
  app = spawn(process.execPath, ["scripts/dev.mjs"], { env, stdio: "pipe" });
  app.stderr.on("data", (c) => (log += c));
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const results = await Promise.all(
        ["afiliados", "citas", "notificaciones", "documentos"].map((n) =>
          fetch(base + "/" + n + "/health"),
        ),
      );
      if (results.every((r) => r.ok)) {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  assert.ok(ready, log);
});
after(async () => {
  if (app && app.exitCode === null) {
    app.kill("SIGTERM");
    await once(app, "exit");
  }
});
let a, b, appointment, slotId, caseId;
test("cada uno de los cuatro procesos responde health", async () => {
  for (const name of ["afiliados", "citas", "notificaciones", "documentos"])
    assert.equal((await call(name, "/health")).status, 200);
  const health = await fetch(base + "/afiliados/health");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal(health.headers.get("x-frame-options"), "DENY");
  assert.equal(health.headers.get("referrer-policy"), "no-referrer");
  assert.match(
    health.headers.get("content-security-policy"),
    /default-src 'none'/,
  );
});
test("los registros no se exponen sin sesión", async () => {
  for (const name of ["afiliados", "citas", "notificaciones", "documentos"])
    assert.equal(
      (await call(name, name === "afiliados" ? "/me" : "/")).status,
      401,
    );
  assert.equal(
    (await call("afiliados", "/_internal/usuarios/falso")).status,
    404,
  );
});
test("registro abre sesión y no devuelve la contraseña", async () => {
  a = await register("Ana");
  b = await register("Luisa");
  const { todayBogota } = await import("../shared/validation.js");
  assert.equal(a.body.data.fechaAfiliacion, todayBogota());
  const persisted = (await call("afiliados", "/me", { cookie: a.cookie })).body
    .data;
  assert.equal(persisted.fechaAfiliacion, a.body.data.fechaAfiliacion);
  assert.equal(
    (await call("documentos", "/afiliacion/pdf", { cookie: a.cookie })).status,
    200,
  );
  assert.ok(a.cookie);
  assert.equal(a.body.data.password_hash, undefined);
  assert.equal(
    (await call("afiliados", "/me", { cookie: a.cookie })).body.data.nombres,
    "Ana",
  );
});
test("datos de contacto y beneficiario pertenecen a la cuenta", async () => {
  assert.equal(
    (
      await call("afiliados", "/me", {
        method: "PATCH",
        cookie: a.cookie,
        body: {
          telefono: "3007654321",
          direccion: "Calle ficticia 20",
          ciudad: "Medellín",
        },
      })
    ).status,
    200,
  );
  const member = await call("afiliados", "/beneficiarios", {
    method: "POST",
    cookie: a.cookie,
    body: {
      nombre: "Integrante Ficticio",
      tipoDocumento: "TI",
      documento: String(randomInt(1000000000, 1999999999)),
      parentesco: "Hijo/a",
      nacimiento: "2015-01-02",
    },
  });
  assert.equal(member.status, 201, JSON.stringify(member.body));
  assert.equal(
    (
      await call("afiliados", `/beneficiarios/${member.body.data.id}`, {
        method: "DELETE",
        cookie: b.cookie,
      })
    ).status,
    404,
  );
  assert.equal(
    (await call("afiliados", "/beneficiarios", { cookie: b.cookie })).body.data
      .length,
    0,
  );
});
test("reserva concurrente permite solo una cita por horario", async () => {
  const slots = (await call("citas", "/disponibilidad", { cookie: a.cookie }))
    .body.data;
  assert.ok(slots.length);
  slotId = slots[0].id;
  const results = await Promise.all([
    call("citas", "/", { method: "POST", cookie: a.cookie, body: { slotId } }),
    call("citas", "/", { method: "POST", cookie: b.cookie, body: { slotId } }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const winner = results[0].status === 201 ? a : b;
  appointment = {
    id: results.find((r) => r.status === 201).body.data.id,
    owner: winner,
    other: winner === a ? b : a,
  };
});
test("reagendar y cancelar solo permiten actuar al titular", async () => {
  assert.equal(
    (
      await call("citas", `/${appointment.id}/cancelar`, {
        method: "PATCH",
        body: {},
        cookie: appointment.other.cookie,
      })
    ).status,
    404,
  );
  const next = (
    await call("citas", "/disponibilidad", { cookie: appointment.owner.cookie })
  ).body.data[0].id;
  assert.equal(
    (
      await call("citas", `/${appointment.id}/reagendar`, {
        method: "PATCH",
        body: { slotId: next },
        cookie: appointment.owner.cookie,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("citas", `/${appointment.id}/cancelar`, {
        method: "PATCH",
        body: {},
        cookie: appointment.owner.cookie,
      })
    ).status,
    200,
  );
  const slots = (await call("citas", "/disponibilidad", { cookie: a.cookie }))
    .body.data;
  assert.ok(slots.some((s) => s.id === next));
});
test("PQRS genera radicado, conserva seguimiento y aísla el caso", async () => {
  const result = await call("atencion", "/", {
    method: "POST",
    cookie: a.cookie,
    body: {
      tipo: "Petición",
      asunto: "Consulta de ejemplo",
      descripcion: "Quiero orientación de prueba sobre un trámite del portal.",
    },
  });
  assert.equal(result.status, 201);
  assert.match(result.body.data.radicado, /^VIR-/);
  caseId = result.body.data.id;
  assert.equal(
    (await call("atencion", `/${caseId}`, { cookie: b.cookie })).status,
    404,
  );
  assert.equal(
    (
      await call("atencion", `/${caseId}/mensajes`, {
        method: "POST",
        cookie: a.cookie,
        body: { mensaje: "Información adicional para mi solicitud de prueba." },
      })
    ).status,
    201,
  );
  assert.equal(
    (await call("atencion", `/${caseId}`, { cookie: a.cookie })).body.data
      .mensajes.length,
    1,
  );
});
test("eventos llegan a la bandeja y conservan preferencia de correo", async () => {
  let notices = [];
  for (let i = 0; i < 40; i++) {
    notices = (await call("notificaciones", "/", { cookie: a.cookie })).body
      .data;
    if (notices.some((n) => n.titulo.includes("actualizados"))) break;
    await delay(150);
  }
  assert.ok(notices.some((n) => n.titulo.includes("actualizados")));
  assert.ok(notices.every((n) => n.email_status === "Sin configurar"));
  assert.equal(
    (
      await call("notificaciones", "/" + notices[0].id, {
        method: "PATCH",
        body: {},
        cookie: b.cookie,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("notificaciones", "/leer-todas", {
        method: "PATCH",
        body: {},
        cookie: a.cookie,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("notificaciones", "/preferencias", {
        method: "PATCH",
        body: { emailEnabled: false },
        cookie: a.cookie,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("notificaciones", "/preferencias", { cookie: a.cookie })).body
      .data.emailEnabled,
    false,
  );
});
test("logout revoca el token y rechaza la sesión anterior", async () => {
  await call("afiliados", "/logout", {
    method: "POST",
    body: {},
    cookie: a.cookie,
  });
  assert.equal((await call("citas", "/", { cookie: a.cookie })).status, 401);
});

test("eventos son idempotentes y el correo usa un SMTP local real", async () => {
  const delivered = [];
  const sockets = new Set();
  const smtp = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 local.test ESMTP ready\r\n");
    let buffer = "",
      data = false,
      message = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === ".") {
            data = false;
            delivered.push(message);
            message = "";
            socket.write("250 accepted\r\n");
          } else message += line + "\n";
        } else if (/^EHLO|^HELO/.test(line))
          socket.write("250-local.test\r\n250 PIPELINING\r\n");
        else if (/^DATA/.test(line)) {
          data = true;
          socket.write("354 send data\r\n");
        } else if (/^QUIT/.test(line)) {
          socket.end("221 bye\r\n");
        } else socket.write("250 ok\r\n");
      }
    });
  });
  smtp.listen(42525, "127.0.0.1");
  await once(smtp, "listening");
  const worker = spawn(
    process.execPath,
    ["services/notificaciones/src/server.js"],
    {
      env: {
        ...env,
        NOTIFICACIONES_PORT: "5104",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "42525",
        SMTP_SECURE: "false",
        SMTP_USER: "",
        SMTP_POLL_MS: "200",
      },
      stdio: "pipe",
    },
  );
  worker.stderr.on("data", () => {});
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch("http://127.0.0.1:5104/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    assert.ok(ready);
    const eventId = randomUUID(),
      payload = {
        id: eventId,
        userId: b.body.data.id,
        title: "Comprobacion SMTP",
        message: "Aviso de prueba interno.",
        link: "notificaciones",
      };
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": env.INTERNAL_API_KEY,
      },
      body: JSON.stringify(payload),
    };
    assert.equal(
      (
        await fetch("http://127.0.0.1:5104/_internal/eventos", {
          ...options,
          headers: { ...options.headers, "X-Internal-Key": "incorrecta" },
        })
      ).status,
      401,
    );
    await fetch("http://127.0.0.1:5104/_internal/eventos", options);
    await fetch("http://127.0.0.1:5104/_internal/eventos", options);
    let match;
    for (let i = 0; i < 100; i++) {
      const notices = (await call("notificaciones", "/", { cookie: b.cookie }))
        .body.data;
      const found = notices.filter((n) => n.titulo === "Comprobacion SMTP");
      assert.ok(found.length <= 1);
      match = found[0];
      if (match?.email_status === "Enviado") break;
      await delay(100);
    }
    assert.equal(match?.email_status, "Enviado");
    assert.equal(
      delivered.filter((m) => m.includes("Subject: Virelia: Comprobacion SMTP"))
        .length,
      1,
    );
  } finally {
    worker.kill("SIGTERM");
    await once(worker, "exit");
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => smtp.close(resolve));
  }
});

test("MySQL conserva los datos y la sesión al reiniciar los servicios", async () => {
  app.kill("SIGTERM");
  await once(app, "exit");
  await seedAuthorizedSchedules(env);
  app = spawn(process.execPath, ["scripts/dev.mjs"], { env, stdio: "pipe" });
  app.stderr.on("data", () => {});
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const results = await Promise.all(
        ["afiliados", "citas", "notificaciones", "documentos"].map((n) =>
          fetch(base + "/" + n + "/health"),
        ),
      );
      if (results.every((r) => r.ok)) {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  assert.ok(ready);
  assert.equal(
    (await call("afiliados", "/me", { cookie: b.cookie })).body.data.id,
    b.body.data.id,
  );
  const login = await call("afiliados", "/login", {
    method: "POST",
    body: { email: a.body.data.email, password: "Prueba123!" },
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await call("atencion", `/${caseId}`, { cookie: login.cookie })).body.data
      .mensajes.length,
    1,
  );
});

// Direct DB seeding creates an authorized professional, never a public role field.
test("roles: paciente no administra agenda; doctor solo administra la suya", async () => {
  const mysql = await import("mysql2/promise");
  const { dbConfig } = await import("../shared/config.js");
  const conn = await mysql.default.createConnection({
    ...dbConfig,
    database: `${env.DB_PREFIX}_afiliados`,
  });
  const doctor = await register("Doctora");
  const other = await register("Otra");
  try {
    await conn.execute(
      "UPDATE users SET specialty='Medicina general',role='doctor' WHERE id IN (?,?)",
      [doctor.body.data.id, other.body.data.id],
    );
  } finally {
    await conn.end();
  }
  assert.equal(
    (await call("citas", "/doctor/horarios", { cookie: b.cookie })).status,
    403,
  );
  const tomorrow = new Date(Date.now() + 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  const create = await call("citas", "/doctor/horarios", {
    method: "POST",
    cookie: doctor.cookie,
    body: {
      fecha: tomorrow,
      hora: "10:30",
      especialidad: "Medicina general",
      sede: "Centro de prueba",
    },
  });
  assert.equal(create.status, 201);
  const id = create.body.data.id;
  assert.equal(
    (
      await call("citas", `/doctor/horarios/${id}`, {
        method: "DELETE",
        cookie: other.cookie,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("citas", "/doctor/horarios", {
        method: "POST",
        cookie: doctor.cookie,
        body: {
          fecha: tomorrow,
          hora: "10:30",
          especialidad: "Psicología",
          sede: "Otro centro",
        },
      })
    ).status,
    409,
  );
  const patient = await register("Paciente");
  assert.equal(
    (
      await call("citas", "/", {
        method: "POST",
        cookie: patient.cookie,
        body: { slotId: id },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await call("citas", `/doctor/horarios/${id}`, {
        method: "DELETE",
        cookie: doctor.cookie,
      })
    ).status,
    409,
  );
  assert.equal(
    (await call("citas", "/doctor/horarios", { cookie: doctor.cookie })).body
      .data[0].appointmentId.length,
    36,
  );
});
test("un profesional no puede atender a dos pacientes en la misma fecha y hora aunque existan slots duplicados", async () => {
  const mysql = await import("mysql2/promise");
  const { dbConfig } = await import("../shared/config.js");
  const doctor = await register("Sara");
  const patientOne = await register("Santiago");
  const patientTwo = await register("Julian");
  const affiliates = await mysql.default.createConnection({
    ...dbConfig,
    database: `${env.DB_PREFIX}_afiliados`,
  });
  let professional;
  try {
    await affiliates.execute(
      "UPDATE users SET specialty='Medicina general',role='doctor' WHERE id=?",
      [doctor.body.data.id],
    );
    const [users] = await affiliates.execute(
      "SELECT nombres,apellidos FROM users WHERE id=?",
      [doctor.body.data.id],
    );
    professional = `${users[0].nombres} ${users[0].apellidos}`;
  } finally {
    await affiliates.end();
  }

  const tomorrow = new Date(Date.now() + 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  const published = await call("citas", "/doctor/horarios", {
    method: "POST",
    cookie: doctor.cookie,
    body: {
      fecha: tomorrow,
      hora: "11:00",
      especialidad: "Psicología",
      sede: "Atención virtual",
    },
  });
  assert.equal(published.status, 201);

  // Simulate a legacy/demo slot for the same professional and time with doctor_id NULL.
  const legacySlotId = randomUUID();
  const appointmentsDb = await mysql.default.createConnection({
    ...dbConfig,
    database: `${env.DB_PREFIX}_citas`,
  });
  try {
    await appointmentsDb.execute(
      "INSERT INTO slots(id,especialidad,profesional,doctor_id,sede,fecha,hora,available) VALUES(?,?,?,?,?,?,?,1)",
      [
        legacySlotId,
        "Psicología",
        professional,
        null,
        "Atención virtual",
        tomorrow,
        "11:00",
      ],
    );
  } finally {
    await appointmentsDb.end();
  }

  const firstBooking = await call("citas", "/", {
    method: "POST",
    cookie: patientOne.cookie,
    body: { slotId: published.body.data.id },
  });
  assert.equal(firstBooking.status, 201);

  const visibleToSecondPatient = await call("citas", "/disponibilidad", {
    cookie: patientTwo.cookie,
  });
  assert.ok(
    !visibleToSecondPatient.body.data.some((slot) => slot.id === legacySlotId),
  );
  const secondBooking = await call("citas", "/", {
    method: "POST",
    cookie: patientTwo.cookie,
    body: { slotId: legacySlotId },
  });
  assert.equal(secondBooking.status, 409);
  assert.match(secondBooking.body.error.message, /profesional/i);
});

test("mismo paciente no reserva dos profesionales a la misma hora, incluso en paralelo", async () => {
  const patient = await register("Paciente");
  const slots = (
    await call("citas", "/disponibilidad", { cookie: patient.cookie })
  ).body.data;
  const first = slots.find((s) =>
    slots.some(
      (t) => t.id !== s.id && t.fecha === s.fecha && t.hora === s.hora,
    ),
  );
  assert.ok(first);
  const second = slots.find(
    (s) =>
      s.id !== first.id && s.fecha === first.fecha && s.hora === first.hora,
  );
  const results = await Promise.all(
    [first, second].map((s) =>
      call("citas", "/", {
        method: "POST",
        cookie: patient.cookie,
        body: { slotId: s.id },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const remaining = (
    await call("citas", "/disponibilidad", { cookie: patient.cookie })
  ).body.data;
  assert.ok(
    !remaining.some((s) => s.fecha === first.fecha && s.hora === first.hora),
  );
  const winner = results.find((r) => r.status === 201).body.data.id;
  const again = await call("citas", "/", {
    method: "POST",
    cookie: patient.cookie,
    body: { slotId: results[0].status === 201 ? second.id : first.id },
  });
  assert.equal(again.status, 409);
  assert.equal(
    (
      await call("citas", `/${winner}/cancelar`, {
        method: "PATCH",
        body: {},
        cookie: patient.cookie,
      })
    ).status,
    200,
  );
});
test("registro rechaza rol arbitrario y tipo/edad incompatibles en la API", async () => {
  const base = {
    email: `reject-${randomUUID()}@example.test`,
    password: "Prueba123!",
    nombres: "Ana",
    apellidos: "Prueba",
    tipoDocumento: "CC",
    documento: "1234567890",
    nacimiento: "1995-05-12",
    telefono: "3001234567",
    direccion: "Calle 10",
    ciudad: "Bogotá",
    consentimiento: true,
  };
  assert.equal(
    (
      await call("afiliados", "/registro", {
        method: "POST",
        body: { ...base, role: "doctor" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("afiliados", "/registro", {
        method: "POST",
        body: { ...base, tipoDocumento: "TI" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("afiliados", "/registro", {
        method: "POST",
        body: { ...base, documento: "ABC123" },
      })
    ).status,
    400,
  );
});
test("reprogramar a una hora ocupada por el mismo paciente conserva ambas citas originales", async () => {
  const patient = await register("Paciente");
  const available = (
    await call("citas", "/disponibilidad", { cookie: patient.cookie })
  ).body.data;
  const first = available.find((s) =>
    available.some(
      (t) => t.id !== s.id && t.fecha === s.fecha && t.hora === s.hora,
    ),
  );
  assert.ok(first);
  const same = available.find(
    (s) =>
      s.id !== first.id && s.fecha === first.fecha && s.hora === first.hora,
  );
  const other = available.find(
    (s) => s.fecha !== first.fecha || s.hora !== first.hora,
  );
  assert.ok(other);
  const initial = await call("citas", "/", {
    method: "POST",
    cookie: patient.cookie,
    body: { slotId: first.id },
  });
  const second = await call("citas", "/", {
    method: "POST",
    cookie: patient.cookie,
    body: { slotId: other.id },
  });
  assert.equal(initial.status, 201);
  assert.equal(second.status, 201);
  assert.equal(
    (
      await call("citas", `/${second.body.data.id}/reagendar`, {
        method: "PATCH",
        cookie: patient.cookie,
        body: { slotId: same.id },
      })
    ).status,
    409,
  );
  const appointments = (await call("citas", "/", { cookie: patient.cookie }))
    .body.data;
  assert.equal(
    appointments.find((a) => a.id === second.body.data.id).slot_id,
    other.id,
  );
  assert.equal(appointments.filter((a) => a.estado === "Agendada").length, 2);
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

test("atención clínica: autorización, borrador, finalización, inmutabilidad, adendas y PDF", async () => {
  const mysql = await import("mysql2/promise"),
    { dbConfig } = await import("../shared/config.js");
  const doctor = await register("Laura"),
    otherDoctor = await register("Maria"),
    patient = await register("Paciente"),
    otherPatient = await register("Otro");
  const affiliates = await mysql.default.createConnection({
      ...dbConfig,
      database: env.DB_PREFIX + "_afiliados",
    }),
    c = await mysql.default.createConnection({
      ...dbConfig,
      database: env.DB_PREFIX + "_citas",
    });
  try {
    for (const d of [doctor, otherDoctor])
      await affiliates.execute(
        "UPDATE users SET specialty='Medicina general',role='doctor' WHERE id=?",
        [d.body.data.id],
      );
    const slot = randomUUID(),
      appointment = randomUUID();
    await c.execute(
      "INSERT INTO slots(id,especialidad,profesional,doctor_id,sede,fecha,hora,available) VALUES(?,'General','Laura',?,'Sede','2025-01-10','10:00',0)",
      [slot, doctor.body.data.id],
    );
    await c.execute(
      "INSERT INTO appointments(id,user_id,slot_id,paciente_nombre) VALUES(?,?,?,'Paciente Autorizado')",
      [appointment, patient.body.data.id, slot],
    );
    const route = `/doctor/atenciones/${appointment}`;
    assert.equal(
      (await call("citas", route, { cookie: patient.cookie })).status,
      403,
    );
    assert.equal(
      (await call("citas", route, { cookie: otherDoctor.cookie })).status,
      404,
    );
    const draft = {
      reason: "Consulta registrada en entorno aislado",
      observations: "Observación de verificación",
      diagnosis: "Información registrada por profesional de prueba",
      plan: "Plan registrado por profesional de prueba",
    };
    assert.equal(
      (
        await call("citas", route, {
          method: "PUT",
          cookie: doctor.cookie,
          body: draft,
        })
      ).status,
      200,
    );
    let record = (await call("citas", route, { cookie: doctor.cookie })).body
      .data.record;
    assert.equal(record.status, "Borrador");
    assert.equal(
      (await call("documentos", "/historia", { cookie: patient.cookie })).body
        .data.records.length,
      0,
    );
    assert.equal(
      (
        await call("citas", route, {
          method: "PUT",
          cookie: doctor.cookie,
          body: { ...draft, version: 99 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("citas", route + "/finalizar", {
          method: "POST",
          cookie: doctor.cookie,
          body: {},
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("citas", route, {
          method: "PUT",
          cookie: doctor.cookie,
          body: { ...draft, version: 1 },
        })
      ).status,
      409,
    );
    await assert.rejects(() =>
      c.execute("UPDATE clinical_encounters SET reason='changed' WHERE id=?", [
        record.id,
      ]),
    );
    assert.equal(
      (
        await call("citas", route + "/adendas", {
          method: "POST",
          cookie: doctor.cookie,
          body: { content: "Adenda registrada en el entorno de pruebas" },
        })
      ).status,
      201,
    );
    const history = (
      await call("documentos", "/historia", { cookie: patient.cookie })
    ).body.data;
    assert.equal(history.records.length, 1);
    assert.equal(history.records[0].addenda.length, 1);
    assert.equal(history.records[0].reason, draft.reason);
    assert.equal(
      (await call("documentos", "/historia", { cookie: otherPatient.cookie }))
        .body.data.records.length,
      0,
    );
    assert.equal(
      (
        await call("documentos", `/historia/${patient.body.data.id}`, {
          cookie: otherPatient.cookie,
        })
      ).status,
      404,
    );
    const pdf = await call("documentos", "/historia/pdf", {
      cookie: patient.cookie,
    });
    if (process.env.QA_PDF_DIR) {
      const { writeFile, mkdir } = await import("node:fs/promises");
      await mkdir(process.env.QA_PDF_DIR, { recursive: true });
      await writeFile(process.env.QA_PDF_DIR + "/history.pdf", pdf.body);
    }
    assert.ok(
      (
        await call("documentos", "/", { cookie: patient.cookie })
      ).body.data.find((d) => d.type === "historia").issuedAt,
    );
    assert.equal(pdf.status, 200);
    assert.equal(pdf.body.subarray(0, 4).toString(), "%PDF");
    // Restart only clinical process; persisted record and adenda still available through Documentos.
    app.kill("SIGTERM");
    await once(app, "exit");
    app = spawn(process.execPath, ["scripts/dev.mjs"], { env, stdio: "pipe" });
    app.stderr.on("data", () => {});
    await delay(1200);
    assert.equal(
      (await call("documentos", "/historia", { cookie: patient.cookie })).body
        .data.records[0].addenda.length,
      1,
    );
  } finally {
    await affiliates.end();
    await c.end();
  }
});
test("certificado: datos faltantes, estado inactivo fiel, PDF, huella y privacidad", async () => {
  const mysql = await import("mysql2/promise"),
    { dbConfig } = await import("../shared/config.js"),
    { tokenHash } = await import("../shared/security.js");
  const patient = await register("Afiliada"),
    c = await mysql.default.createConnection({
      ...dbConfig,
      database: env.DB_PREFIX + "_afiliados",
    });
  try {
    // Perfil heredado sin fecha: la actualización no inventa ni rellena su dato.
    await c.execute("UPDATE users SET affiliation_date=NULL WHERE id=?", [
      patient.body.data.id,
    ]);
    assert.equal(
      (await call("documentos", "/afiliacion/pdf", { cookie: patient.cookie }))
        .status,
      409,
    );
    await c.execute(
      "UPDATE users SET affiliation_date='2020-03-01',affiliation_number='AF-123',estado='Inactivo' WHERE id=?",
      [patient.body.data.id],
    );
    const result = await call("documentos", "/afiliacion/pdf", {
      cookie: patient.cookie,
    });
    if (process.env.QA_PDF_DIR) {
      const { writeFile, mkdir } = await import("node:fs/promises");
      await mkdir(process.env.QA_PDF_DIR, { recursive: true });
      await writeFile(process.env.QA_PDF_DIR + "/certificate.pdf", result.body);
    }
    assert.equal(result.status, 200);
    assert.equal(result.body.subarray(0, 4).toString(), "%PDF");
    assert.ok(
      (
        await call("documentos", "/", { cookie: patient.cookie })
      ).body.data.find((d) => d.type === "afiliacion").issuedAt,
    );
    const docs = await mysql.default.createConnection({
      ...dbConfig,
      database: env.DB_PREFIX + "_documentos",
    });
    const [[r]] = await docs.execute(
      "SELECT * FROM certificates WHERE user_id=?",
      [patient.body.data.id],
    );
    assert.equal(r.pdf_hash, tokenHash(result.body));
    await docs.end();
    assert.equal((await call("documentos", "/afiliacion/pdf")).status, 401);
    const code = "f".repeat(64),
      pdfHash = tokenHash(result.body);
    const docs2 = await mysql.default.createConnection({
      ...dbConfig,
      database: env.DB_PREFIX + "_documentos",
    });
    await docs2.execute(
      "INSERT INTO certificates(code_hash,user_id,pdf_hash,issued_at) VALUES(?,?,?,UTC_TIMESTAMP())",
      [tokenHash(code), patient.body.data.id, pdfHash],
    );
    await docs2.end();
    const verify = await call("documentos", "/verificar", {
      method: "POST",
      body: { code, pdfHash },
    });
    assert.equal(verify.body.data.valid, true);
    assert.deepEqual(Object.keys(verify.body.data).sort(), [
      "issuedAt",
      "valid",
    ]);
    assert.equal(
      (
        await call("documentos", "/verificar", {
          method: "POST",
          body: { code, pdfHash: "0".repeat(64) },
        })
      ).body.data.valid,
      false,
    );
  } finally {
    await c.end();
  }
});
test("doctores homónimos conservan agendas independientes", async () => {
  const mysql = await import("mysql2/promise"),
    { dbConfig } = await import("../shared/config.js"),
    one = await register("Ana"),
    two = await register("Ana"),
    c = await mysql.default.createConnection({
      ...dbConfig,
      database: env.DB_PREFIX + "_afiliados",
    });
  try {
    for (const d of [one, two])
      await c.execute(
        "UPDATE users SET specialty='Medicina general',role='doctor',apellidos='Torres' WHERE id=?",
        [d.body.data.id],
      );
    const data = {
      fecha: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
      hora: "10:00",
      especialidad: "General",
      sede: "Sede institucional",
    };
    const results = await Promise.all(
      [one, two].map((d) =>
        call("citas", "/doctor/horarios", {
          method: "POST",
          cookie: d.cookie,
          body: data,
        }),
      ),
    );
    assert.deepEqual(
      results.map((r) => r.status),
      [201, 201],
    );
  } finally {
    await c.end();
  }
});

test("consola crea y actualiza especialidad; la API no acepta sustituirla desde la página", async () => {
  async function cli(file, answers) {
    const child = spawn(process.execPath, [file], { env, stdio: "pipe" });
    let pending = "",
      index = 0,
      error = "";
    child.stderr.on("data", (c) => (error += c));
    child.stdout.on("data", (chunk) => {
      pending += chunk;
      while (index < answers.length && pending.includes(answers[index][0])) {
        const answer = answers[index++][1];
        pending = "";
        child.stdin.write(answer + "\n");
      }
    });
    const [code] = await once(child, "exit");
    assert.equal(code, 0, error);
    assert.equal(index, answers.length);
  }
  const mail = `doctor-console-${randomUUID()}@example.test`,
    pass = "PruebaSegura123!";
  await cli("scripts/create-doctor.mjs", [
    ["Correo del profesional:", mail],
    ["Nombres:", "Ana"],
    ["Apellidos:", "Torres"],
    ["Especialidad:", "Cardiología"],
    ["Contraseña nueva", pass],
  ]);
  const login = await call("afiliados", "/login", {
    method: "POST",
    body: { email: mail, password: pass },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.especialidad, "Cardiología");
  const booking = await call("citas", "/doctor/horarios", {
    method: "POST",
    cookie: login.cookie,
    body: {
      fecha: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      hora: "10:00",
      sede: "Sede autorizada",
      especialidad: "Odontología",
    },
  });
  assert.equal(booking.status, 201);
  assert.equal(booking.body.data.especialidad, "Cardiología");
  await cli("scripts/set-doctor-specialty.mjs", [
    ["Correo del doctor existente:", mail],
    ["Especialidad:", "Neurología"],
  ]);
  const me = await call("afiliados", "/me", { cookie: login.cookie });
  assert.equal(me.body.data.especialidad, "Neurología");
  const agenda = await call("citas", "/doctor/horarios", {
    cookie: login.cookie,
  });
  assert.equal(
    agenda.body.data.find((s) => s.id === booking.body.data.id).especialidad,
    "Cardiología",
  );
});
