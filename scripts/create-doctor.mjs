import { randomUUID } from "node:crypto";
import { db, rows, closePools } from "../shared/db.js";
import { email, personName, password } from "../shared/validation.js";
import { hashPassword } from "../shared/security.js";
import { ask, finish } from "./prompt.mjs";
try {
  const correo = email(await ask("Correo del profesional: "));
  const nombres = personName(await ask("Nombres: ")),
    apellidos = personName(await ask("Apellidos: "));
  const especialidad = personName(
    await ask("Especialidad: "),
    "Especialidad",
    80,
  );
  const pass = password(await ask("Contraseña nueva (no se muestra): ", true));
  // No public endpoint can grant this role. Existing patients are never silently promoted.
  await rows(
    db("afiliados"),
    "INSERT INTO users(id,email,password_hash,email_verified,role,nombres,apellidos,tipo_documento,documento,nacimiento,telefono,direccion,ciudad,specialty) VALUES(?,?,?,1,'doctor',?,?,'INTERNO',?,'1990-01-01','3000000000','Perfil profesional de prueba','Bogotá',?)",
    [
      randomUUID(),
      correo,
      hashPassword(pass),
      nombres,
      apellidos,
      `DR-${randomUUID().slice(0, 20)}`,
      especialidad,
    ],
  );
  console.log(
    "Profesional creado. Ingresa desde Acceso profesional con ese correo y contraseña.",
  );
} catch (e) {
  console.error(
    e.code === "ER_DUP_ENTRY"
      ? "Ese correo ya existe; no se modificó su rol."
      : e.message,
  );
  process.exitCode = 1;
} finally {
  finish();
  await closePools();
}
