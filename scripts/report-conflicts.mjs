import { db, rows, closePools } from "../shared/db.js";
try {
  const conflicts = await rows(
    db("citas"),
    "SELECT a.user_id,s.fecha,s.hora,COUNT(*) AS cantidad FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.estado='Agendada' GROUP BY a.user_id,s.fecha,s.hora HAVING COUNT(*)>1",
  );
  console.table(conflicts);
  console.log("Revisión de solo lectura. No se canceló ninguna cita.");
} finally {
  await closePools();
}
