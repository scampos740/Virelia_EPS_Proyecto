import { db, rows, transaction, closePools } from "../shared/db.js";
import { email, personName, HttpError } from "../shared/validation.js";
import { audit } from "../shared/audit.js";
import { ask, finish } from "./prompt.mjs";
try {
  const mail = email(await ask("Correo del doctor existente: "));
  const specialty = personName(await ask("Especialidad: "), "Especialidad", 80);
  await transaction(db("afiliados"), async (c) => {
    const [doctor] = await rows(
      c,
      "SELECT id FROM users WHERE email=? AND role='doctor' FOR UPDATE",
      [mail],
    );
    if (!doctor)
      throw new HttpError(404, "No se encontró un doctor con ese correo.");
    await rows(c, "UPDATE users SET specialty=? WHERE id=?", [
      specialty,
      doctor.id,
    ]);
    await audit(c, "operador-local", "doctor.specialty.set", doctor.id);
  });
  console.log(
    "Especialidad guardada. El doctor debe cerrar sesión e ingresar nuevamente. Los horarios anteriores conservan su especialidad.",
  );
} catch (e) {
  console.error(e.code || e.message);
  process.exitCode = 1;
} finally {
  finish();
  await closePools();
}
