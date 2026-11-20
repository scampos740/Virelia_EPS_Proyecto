import { db, rows, transaction, closePools } from "../shared/db.js";
import { ask as prompt, finish } from "./prompt.mjs";
import { requireRow } from "../shared/validation.js";
const slotId = await prompt("ID del horario histórico: "),
  doctorId = await prompt(
    "ID del doctor autorizado (validación institucional previa): ",
  );
try {
  const [doctor] = await rows(
    db("afiliados"),
    "SELECT id,nombres,apellidos FROM users WHERE id=? AND role='doctor'",
    [doctorId],
  );
  requireRow(doctor);
  await transaction(db("citas"), async (c) => {
    const [slot] = await rows(
      c,
      "SELECT * FROM slots WHERE id=? AND doctor_id IS NULL FOR UPDATE",
      [slotId],
    );
    requireRow(slot);
    await rows(c, "UPDATE slots SET doctor_id=?,profesional=? WHERE id=?", [
      doctorId,
      `${doctor.nombres} ${doctor.apellidos}`,
      slotId,
    ]);
  });
  console.log("Horario vinculado. Se conservaron las reservas y su historial.");
} finally {
  await closePools();
  finish();
}
