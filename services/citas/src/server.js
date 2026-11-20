import { doctorSlot } from "../../../shared/doctor-specialty.js";
import { randomUUID } from "node:crypto";
import { db, rows, transaction } from "../../../shared/db.js";
import { startServer, currentUser } from "../../../shared/http.js";
import { HttpError, text, requireRow } from "../../../shared/validation.js";
import { event, startOutbox } from "../../../shared/events.js";
import { clinical, history } from "./clinical.js";
import { requireInternal } from "../../../shared/http.js";
import { appUrl } from "../../../shared/mail.js";
const pool = db("citas");
// A stable row per patient serializes competing bookings, including different doctors.
async function lockPatient(conn, userId) {
  await rows(conn, "INSERT IGNORE INTO appointment_locks(user_id) VALUES(?)", [
    userId,
  ]);
  await rows(
    conn,
    "SELECT user_id FROM appointment_locks WHERE user_id=? FOR UPDATE",
    [userId],
  );
}
function professionalKey(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
async function lockProfessionalSlot(conn, slot) {
  // A single lock covers every slot row for the same professional/date/time,
  // including legacy demo slots whose doctor_id is NULL.
  const key = slot.doctor_id || professionalKey(slot.profesional);
  await rows(
    conn,
    "INSERT IGNORE INTO professional_slot_locks(professional_key,fecha,hora) VALUES(?,?,?)",
    [key, slot.fecha, slot.hora],
  );
  await rows(
    conn,
    "SELECT professional_key FROM professional_slot_locks WHERE professional_key=? AND fecha=? AND hora=? FOR UPDATE",
    [key, slot.fecha, slot.hora],
  );
}
async function reserve(conn, id, userId, exclude = "") {
  const slot = requireRow(
    (await rows(conn, "SELECT * FROM slots WHERE id=? FOR UPDATE", [id]))[0],
  );
  if (new Date(`${slot.fecha}T${slot.hora}:00-05:00`) <= new Date())
    throw new HttpError(409, "Este horario ya pasó.");
  if (!slot.doctor_id)
    throw new HttpError(
      409,
      "Este horario requiere vinculación con un profesional autorizado.",
    );
  if (!slot.available)
    throw new HttpError(409, "Ese horario acaba de ocuparse. Elige otro.");

  // Serialize bookings for this professional and time across different patients
  // and even if duplicate legacy slot rows exist.
  await lockProfessionalSlot(conn, slot);
  const professionalConflict = await rows(
    conn,
    "SELECT a.id FROM appointments a JOIN slots occupied ON occupied.id=a.slot_id WHERE a.estado='Agendada' AND occupied.fecha=? AND occupied.hora=? AND occupied.doctor_id=? AND a.id<>? LIMIT 1 FOR UPDATE",
    [slot.fecha, slot.hora, slot.doctor_id, exclude],
  );
  if (professionalConflict.length)
    throw new HttpError(
      409,
      "Este profesional ya tiene una cita agendada en ese día y hora. Elige otro horario.",
    );

  // Keep the existing rule: one patient cannot book two professionals at the same time.
  const patientConflict = await rows(
    conn,
    "SELECT a.id FROM appointments a JOIN slots occupied ON occupied.id=a.slot_id WHERE a.user_id=? AND a.estado='Agendada' AND occupied.fecha=? AND occupied.hora=? AND a.id<>? LIMIT 1 FOR UPDATE",
    [userId, slot.fecha, slot.hora, exclude],
  );
  if (patientConflict.length)
    throw new HttpError(
      409,
      "Ya tienes una cita ese día a esa hora. Elige otro horario.",
    );
  await rows(conn, "UPDATE slots SET available=0 WHERE id=?", [id]);
  return slot;
}
async function notify(c, userId, title) {
  await event(
    c,
    userId,
    title,
    "Tu agenda se actualizó. Inicia sesión para consultar los detalles.",
    "citas",
    {
      kind: "appointment",
      text: `${title}. Tienes una actualización de tu cita. Ingresa a tu portal para consultar los detalles:\n\n${appUrl()}/#/citas\n\nVirelia · Agenda de atención.`,
    },
  );
}
startServer("citas", async (req, url, b) => {
  if (url.pathname.startsWith("/_internal/historia/") && req.method === "GET") {
    requireInternal(req);
    return { data: await history(url.pathname.split("/").at(-1)) };
  }
  const u = await currentUser(req),
    p = url.pathname,
    m = req.method;
  if (
    process.env.NODE_ENV === "production" &&
    u.role === "paciente" &&
    !u.fechaAfiliacion
  )
    throw new HttpError(
      403,
      "Tu afiliación debe ser validada por la entidad antes de reservar citas.",
    );
  if (u.estado !== "Activo")
    throw new HttpError(403, "Tu cuenta no está activa.");
  if (p.startsWith("/doctor/atenciones/")) return clinical(req, url, b, u);
  if (p.startsWith("/doctor")) {
    if (u.role !== "doctor")
      throw new HttpError(
        403,
        "Esta sección es exclusiva para profesionales autorizados.",
      );
    if (p === "/doctor/horarios" && m === "GET")
      return {
        data: await rows(
          pool,
          "SELECT s.*,a.id AS appointmentId,a.estado,a.paciente_nombre FROM slots s LEFT JOIN appointments a ON a.slot_id=s.id AND a.estado IN ('Agendada','Atendida') WHERE s.doctor_id=? ORDER BY s.fecha,s.hora",
          [u.id],
        ),
      };
    if (p === "/doctor/horarios" && m === "POST") {
      const data = doctorSlot(b, u),
        id = randomUUID(),
        professional = `${u.nombres} ${u.apellidos}`;
      await transaction(pool, async (c) => {
        await lockProfessionalSlot(c, {
          doctor_id: u.id,
          profesional: professional,
          fecha: data.fecha,
          hora: data.hora,
        });
        await rows(
          c,
          "INSERT INTO slots(id,doctor_id,profesional,especialidad,sede,fecha,hora) VALUES(?,?,?,?,?,?,?)",
          [
            id,
            u.id,
            professional,
            data.especialidad,
            data.sede,
            data.fecha,
            data.hora,
          ],
        );
      });
      return { status: 201, data: { id, ...data } };
    }
    const match = p.match(/^\/doctor\/horarios\/([^/]+)$/);
    if (match && m === "DELETE") {
      await transaction(pool, async (c) => {
        const slot = requireRow(
          (
            await rows(
              c,
              "SELECT * FROM slots WHERE id=? AND doctor_id=? FOR UPDATE",
              [match[1], u.id],
            )
          )[0],
        );
        if (!slot.doctor_id)
          throw new HttpError(
            409,
            "Este horario requiere vinculación con un profesional autorizado.",
          );
        if (!slot.available)
          throw new HttpError(
            409,
            "El horario tiene una reserva. No se puede retirar.",
          );
        // Retire instead of delete to preserve previous cancelled appointments.
        await rows(c, "UPDATE slots SET available=0 WHERE id=?", [slot.id]);
      });
      return { data: { ok: true } };
    }
    return;
  }
  if (u.role === "doctor")
    throw new HttpError(
      403,
      "Usa la agenda profesional para administrar tus horarios.",
    );
  if (p === "/disponibilidad" && m === "GET") {
    const sp = url.searchParams.get("especialidad") || "";
    return {
      data: await rows(
        pool,
        "SELECT s.* FROM slots s WHERE s.available=1 AND s.doctor_id IS NOT NULL AND TIMESTAMP(s.fecha,s.hora)>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 HOUR) AND (?='' OR s.especialidad=?) AND NOT EXISTS(SELECT 1 FROM appointments a JOIN slots occupied ON occupied.id=a.slot_id WHERE a.estado='Agendada' AND occupied.fecha=s.fecha AND occupied.hora=s.hora AND occupied.doctor_id=s.doctor_id) AND NOT EXISTS(SELECT 1 FROM appointments a JOIN slots occupied ON occupied.id=a.slot_id WHERE a.user_id=? AND a.estado='Agendada' AND occupied.fecha=s.fecha AND occupied.hora=s.hora) ORDER BY s.fecha,s.hora LIMIT 168",
        [sp, sp, u.id],
      ),
    };
  }
  if (p === "/" && m === "GET")
    return {
      data: await rows(
        pool,
        "SELECT a.id,a.estado,a.created_at,s.especialidad,s.profesional,s.sede,s.fecha,s.hora,a.slot_id FROM appointments a JOIN slots s ON s.id=a.slot_id WHERE a.user_id=? ORDER BY s.fecha DESC,s.hora",
        [u.id],
      ),
    };
  if (p === "/" && m === "POST") {
    const id = randomUUID(),
      slotId = text(b.slotId, "Horario", 1, 36);
    await transaction(pool, async (c) => {
      await lockPatient(c, u.id);
      await reserve(c, slotId, u.id);
      await rows(
        c,
        "INSERT INTO appointments(id,user_id,slot_id,paciente_nombre) VALUES(?,?,?,?)",
        [id, u.id, slotId, `${u.nombres} ${u.apellidos}`],
      );
      await notify(c, u.id, "Cita agendada");
    });
    return { status: 201, data: { id, estado: "Agendada" } };
  }
  const match = p.match(/^\/([^/]+)\/(cancelar|reagendar)$/);
  if (match && m === "PATCH") {
    await transaction(pool, async (c) => {
      await lockPatient(c, u.id);
      const a = requireRow(
        (
          await rows(
            c,
            "SELECT * FROM appointments WHERE id=? AND user_id=? FOR UPDATE",
            [match[1], u.id],
          )
        )[0],
      );
      const [currentSlot] = await rows(
        c,
        "SELECT fecha,hora FROM slots WHERE id=?",
        [a.slot_id],
      );
      const [clinicalRecord] = await rows(
        c,
        "SELECT id FROM clinical_encounters WHERE appointment_id=?",
        [a.id],
      );
      if (
        clinicalRecord ||
        new Date(`${currentSlot.fecha}T${currentSlot.hora}:00-05:00`) <=
          new Date()
      )
        throw new HttpError(
          409,
          "La cita ya inició o tiene un registro clínico. Contacta a la entidad para revisar cambios.",
        );
      if (a.estado !== "Agendada")
        throw new HttpError(409, "Esta cita ya no admite cambios.");
      if (match[2] === "cancelar")
        await rows(c, "UPDATE appointments SET estado='Cancelada' WHERE id=?", [
          a.id,
        ]);
      else {
        const next = text(b.slotId, "Nuevo horario", 1, 36);
        if (next === a.slot_id)
          throw new HttpError(400, "Elige un horario diferente.");
        await reserve(c, next, u.id, a.id);
        await rows(c, "UPDATE appointments SET slot_id=? WHERE id=?", [
          next,
          a.id,
        ]);
      }
      await rows(c, "UPDATE slots SET available=1 WHERE id=?", [a.slot_id]);
      await notify(
        c,
        u.id,
        match[2] === "cancelar" ? "Cita cancelada" : "Cita reprogramada",
      );
    });
    return { data: { ok: true } };
  }
});
startOutbox(pool);
