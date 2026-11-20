import { randomUUID } from "node:crypto";
import { db, rows, transaction } from "../../../shared/db.js";
import { HttpError, text, requireRow } from "../../../shared/validation.js";
import { audit } from "../../../shared/audit.js";
const pool = db("citas");
const fields = ["reason", "observations", "diagnosis", "plan"];
export async function history(patientId) {
  const result = await rows(
    pool,
    "SELECT id,appointment_id,doctor_name,attended_at,reason,observations,diagnosis,plan,finalized_at FROM clinical_encounters WHERE user_id=? AND status='Finalizada' ORDER BY attended_at,id",
    [patientId],
  );
  for (const r of result)
    r.addenda = await rows(
      pool,
      "SELECT doctor_name,content,created_at FROM clinical_addenda WHERE encounter_id=? ORDER BY created_at,id",
      [r.id],
    );
  return result;
}
export async function clinical(req, url, b, u) {
  const match = url.pathname.match(
    /^\/doctor\/atenciones\/([^/]+)(?:\/(finalizar|adendas))?$/,
  );
  if (!match) return;
  if (u.role !== "doctor")
    throw new HttpError(403, "Se requiere un profesional autorizado.");
  const id = match[1],
    action = match[2],
    method = req.method;
  if (method === "GET" && !action) {
    const [a] = await rows(
      pool,
      "SELECT a.*,s.fecha,s.hora FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.id=? AND s.doctor_id=? AND a.estado IN ('Agendada','Atendida')",
      [id, u.id],
    );
    requireRow(a);
    const [record] = await rows(
      pool,
      "SELECT * FROM clinical_encounters WHERE appointment_id=? AND doctor_id=?",
      [id, u.id],
    );
    const addenda = record
      ? await rows(
          pool,
          "SELECT * FROM clinical_addenda WHERE encounter_id=? ORDER BY created_at,id",
          [record.id],
        )
      : [];
    await audit(pool, u.id, "clinical.read", id);
    return { data: { appointment: a, record: record || null, addenda } };
  }
  if (!["PUT", "POST"].includes(method)) return;
  return transaction(pool, async (c) => {
    const a = requireRow(
      (
        await rows(
          c,
          "SELECT a.*,s.fecha,s.hora FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.id=? AND s.doctor_id=? AND a.estado IN ('Agendada','Atendida') FOR UPDATE",
          [id, u.id],
        )
      )[0],
    );
    if (new Date(`${a.fecha}T${a.hora}:00-05:00`) > new Date())
      throw new HttpError(
        409,
        "La atención se registra cuando llega la fecha y hora de la cita.",
      );
    const record = (
      await rows(
        c,
        "SELECT * FROM clinical_encounters WHERE appointment_id=? FOR UPDATE",
        [id],
      )
    )[0];
    if (action === "adendas" && method === "POST") {
      if (record?.status !== "Finalizada")
        throw new HttpError(
          409,
          "Las adendas requieren una atención finalizada.",
        );
      const content = text(b.content, "Adenda", 5, 6000);
      await rows(
        c,
        "INSERT INTO clinical_addenda(id,encounter_id,doctor_id,doctor_name,content) VALUES(?,?,?,?,?)",
        [randomUUID(), record.id, u.id, `${u.nombres} ${u.apellidos}`, content],
      );
      await audit(c, u.id, "clinical.addendum", record.id);
      return { status: 201, data: { ok: true } };
    }
    if (record?.status === "Finalizada")
      throw new HttpError(
        409,
        "La atención finalizada es inmutable. Registra una adenda.",
      );
    if (action === "finalizar" && method === "POST") {
      requireRow(record);
      for (const f of fields) text(record[f], f, 1, 6000);
      await rows(
        c,
        "UPDATE clinical_encounters SET status='Finalizada',finalized_at=UTC_TIMESTAMP(),version=version+1 WHERE id=?",
        [record.id],
      );
      await rows(c, "UPDATE appointments SET estado='Atendida' WHERE id=?", [
        id,
      ]);
      await audit(c, u.id, "clinical.finalize", record.id);
      return { data: { ok: true } };
    }
    if (!action && method === "PUT") {
      const vals = fields.map((f) => text(b[f] ?? "", f, 0, 6000));
      if (record) {
        if (Number(b.version) !== record.version)
          throw new HttpError(
            409,
            "El borrador cambió en otra ventana. Actualiza antes de editar.",
          );
        await rows(
          c,
          "UPDATE clinical_encounters SET reason=?,observations=?,diagnosis=?,plan=?,version=version+1 WHERE id=?",
          [...vals, record.id],
        );
      } else
        await rows(
          c,
          "INSERT INTO clinical_encounters(id,appointment_id,user_id,doctor_id,doctor_name,attended_at,reason,observations,diagnosis,plan) VALUES(?,?,?,?,?,UTC_TIMESTAMP(),?,?,?,?)",
          [
            randomUUID(),
            id,
            a.user_id,
            u.id,
            `${u.nombres} ${u.apellidos}`,
            ...vals,
          ],
        );
      await audit(c, u.id, "clinical.draft.save", id);
      return { data: { ok: true } };
    }
  });
}
