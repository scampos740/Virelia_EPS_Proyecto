import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  tokenHash,
  equalSecret,
  cookieToken,
  sessionCookie,
} from "../shared/security.js";
import {
  text,
  email,
  date,
  choice,
  contact,
  identity,
  ageAt,
  personName,
  registration,
  futureSlot,
} from "../shared/validation.js";
import { setSecurityHeaders } from "../shared/headers.js";
test("las contraseñas no se almacenan en texto y se verifican", () => {
  const hash = hashPassword("Password123!");
  assert.notEqual(hash, "Password123!");
  assert.equal(verifyPassword("Password123!", hash), true);
  assert.equal(verifyPassword("Incorrecta", hash), false);
  assert.notEqual(hash, hashPassword("Password123!"));
});
test("sesiones y secretos comparan solo valores válidos", () => {
  assert.equal(equalSecret("", ""), false);
  assert.equal(equalSecret("abc", "abc"), true);
  assert.equal(equalSecret("a", "b"), false);
  assert.equal(tokenHash("token").length, 64);
  assert.equal(
    cookieToken({ headers: { cookie: "otra=1; virelia_session=abc123" } }),
    "abc123",
  );
  assert.equal(cookieToken({ headers: {} }), "");
  assert.match(sessionCookie("x"), /HttpOnly; SameSite=Lax/);
});
test("las respuestas HTTP agregan cabeceras defensivas", () => {
  const values = new Map();
  setSecurityHeaders({ setHeader: (name, value) => values.set(name, value) });
  assert.equal(values.get("X-Content-Type-Options"), "nosniff");
  assert.equal(values.get("X-Frame-Options"), "DENY");
  assert.equal(values.get("Referrer-Policy"), "no-referrer");
  assert.match(values.get("Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.equal(
    values.get("Permissions-Policy"),
    "camera=(), geolocation=(), microphone=()",
  );
});
for (const [name, fn] of [
  ["correo", () => email("no-correo")],
  ["fecha imposible", () => date("2026-02-30")],
  ["fecha futura", () => date("2999-01-01")],
  ["texto vacío", () => text("", "Nombre")],
  ["opción desconocida", () => choice("Otro", ["Uno"], "Tipo")],
  [
    "teléfono incorrecto",
    () =>
      contact({ telefono: "letras", direccion: "Calle 1", ciudad: "Bogotá" }),
  ],
])
  test(`validación rechaza ${name}`, () => assert.throws(fn));
test("correo normalizado y fecha real aceptados", () => {
  assert.equal(email(" ANA@EXAMPLE.TEST "), "ana@example.test");
  assert.equal(date("2000-02-29"), "2000-02-29");
});

test("documento: límites, caracteres y relación con la edad", () => {
  assert.equal(identity("CC", "123", "2000-01-01"), "123");
  assert.equal(identity("CC", "1234567890", "2000-01-01"), "1234567890");
  for (const doc of ["12", "12345678901", "12A45", "12.345", "000"])
    assert.throws(() => identity("CC", doc, "2000-01-01"));
  const today = new Date();
  const birth = new Date(today);
  birth.setUTCFullYear(today.getUTCFullYear() - 10);
  assert.equal(
    identity("TI", "1023456789", birth.toISOString().slice(0, 10)),
    "1023456789",
  );
  assert.throws(() => identity("TI", "1023456789", "1995-01-01"));
  assert.throws(() =>
    identity("CC", "1023456789", birth.toISOString().slice(0, 10)),
  );
  assert.equal(identity("PPT", "12345678", "1995-01-01"), "12345678");
  assert.throws(() => identity("PPT", "123456789", "1995-01-01"));
  assert.equal(identity("CE", "1234567", "1995-01-01"), "1234567");
  assert.throws(() => identity("CE", "12345678", "1995-01-01"));
});
test("edad cambia el día del cumpleaños", () => {
  assert.equal(ageAt("2008-11-18", "2026-11-17"), 17);
  assert.equal(ageAt("2008-11-18", "2026-11-18"), 18);
});
test("nombres y contacto permiten acentos y nomenclatura, rechazan scripts y cifras en ciudad", () => {
  assert.equal(personName("  María José  "), "María José");
  assert.equal(personName("O'Connor"), "O'Connor");
  for (const v of ["Ana123", "<script>", "Ana 5", "Ana-"])
    assert.throws(() => personName(v));
  const c = contact({
    telefono: "+573001234567",
    direccion: "Carrera 10 # 20-30",
    ciudad: "Bogotá",
  });
  assert.equal(c.telefono, "3001234567");
  assert.throws(() => contact({ ...c, telefono: "1234567890" }));
  assert.throws(() =>
    contact({ ...c, direccion: "<script>alert(1)</script>" }),
  );
});
test("registro rechaza rol inyectado y contraseña débil", () => {
  const b = {
    nombres: "Ana",
    apellidos: "Prueba",
    email: "ana@example.test",
    password: "Prueba123!",
    tipoDocumento: "CC",
    documento: "1234567890",
    nacimiento: "2000-01-01",
    telefono: "3001234567",
    direccion: "Calle 10",
    ciudad: "Bogotá",
    consentimiento: true,
  };
  assert.equal(registration(b).nombres, "Ana");
  assert.throws(() => registration({ ...b, role: "doctor" }));
  assert.throws(() => registration({ ...b, password: "12345678" }));
  assert.throws(() => registration({ ...b, consentimiento: false }));
});
test("horario profesional valida fecha futura y intervalos", () => {
  const b = {
    fecha: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    hora: "09:30",
    especialidad: "Medicina general",
    sede: "Centro Norte",
  };
  assert.equal(futureSlot(b).hora, "09:30");
  assert.throws(() => futureSlot({ ...b, hora: "09:15" }));
  assert.throws(() => futureSlot({ ...b, fecha: "2020-01-01" }));
  assert.throws(() => futureSlot({ ...b, fecha: "2027-02-30" }));
});

test("producción rechaza configuración local o sin protecciones", async () => {
  const { validateProduction } = await import("../shared/production.js");
  const old = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => validateProduction());
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
  }
});

test("la especialidad del horario procede del perfil, no de la petición del navegador", async () => {
  const { doctorSlot } = await import("../shared/doctor-specialty.js");
  const body = {
    fecha: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    hora: "10:00",
    sede: "Sede autorizada",
    especialidad: "Especialidad adulterada",
  };
  assert.equal(
    doctorSlot(body, { especialidad: "Cardiología" }).especialidad,
    "Cardiología",
  );
  assert.throws(() => doctorSlot(body, {}), /operador/);
});

test("la fecha de afiliación usa el cambio de día de Colombia y no la medianoche UTC", async () => {
  const { todayBogota } = await import("../shared/validation.js");
  assert.equal(todayBogota(new Date("2026-11-20T04:59:59Z")), "2026-11-19");
  assert.equal(todayBogota(new Date("2026-11-20T05:00:00Z")), "2026-11-20");
});
