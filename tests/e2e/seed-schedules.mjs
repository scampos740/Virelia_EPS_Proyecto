// Exclusivo del prefijo separado de E2E. Nunca se ejecuta en producción.
import { db, rows, closePools } from "../../shared/db.js";
import { hashPassword } from "../../shared/security.js";
import { randomUUID } from "node:crypto";
if (
  process.env.NODE_ENV === "production" ||
  !process.env.DB_PREFIX.endsWith("_e2e")
)
  throw Error("Solo E2E aislado");
const id = randomUUID();
await rows(
  db("afiliados"),
  "INSERT INTO users(id,email,password_hash,nombres,apellidos,tipo_documento,documento,nacimiento,telefono,direccion,ciudad,role,email_verified,specialty) VALUES(?,?,?,'Profesional','E2E','CC',?,'1980-01-01','3001234567','Calle 10','Bogotá','doctor',1,'Medicina general')",
  [id, `${id}@example.test`, hashPassword(randomUUID()), id.slice(0, 20)],
);
await rows(
  db("citas"),
  "UPDATE slots SET doctor_id=? WHERE doctor_id IS NULL AND profesional=(SELECT name FROM (SELECT profesional AS name FROM slots WHERE doctor_id IS NULL LIMIT 1) s)",
  [id],
);
await closePools();
