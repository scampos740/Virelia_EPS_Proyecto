import { randomUUID } from "node:crypto";
import { mailTransport, appUrl } from "../../../shared/mail.js";
import { db, rows } from "../../../shared/db.js";
import {
  startServer,
  currentUser,
  requireInternal,
  internal,
} from "../../../shared/http.js";
import { text, HttpError } from "../../../shared/validation.js";
const pool = db("notificaciones");
startServer("notificaciones", async (req, url, b) => {
  const p = url.pathname,
    m = req.method;
  if (p === "/_internal/eventos" && m === "POST") {
    requireInternal(req);
    const id = text(b.id, "Evento", 1, 36),
      user = text(b.userId, "Usuario", 1, 36);
    await rows(
      pool,
      "INSERT IGNORE INTO notifications(id,event_id,user_id,titulo,mensaje,link,email_status,email_text,email_kind)VALUES(?,?,?,?,?,?,?,?,?)",
      [
        randomUUID(),
        id,
        user,
        text(b.title, "Título", 1, 160),
        text(b.message, "Mensaje", 1, 2000),
        text(b.link, "Enlace", 1, 150),
        process.env.SMTP_HOST ? "Pendiente" : "Sin configurar",
        b.email ? text(b.email.text, "Correo", 1, 10000) : null,
        [
          "verification",
          "authentication",
          "appointment",
          "password_reset",
          "password_reset",
        ].includes(b.email?.kind)
          ? b.email.kind
          : "notification",
      ],
    );
    return { status: 201, data: { ok: true } };
  }
  const u = await currentUser(req);
  if (p === "/" && m === "GET")
    return {
      data: await rows(
        pool,
        "SELECT id,titulo,mensaje,link,leida,email_status,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        [u.id],
      ),
    };
  if (p === "/preferencias" && m === "GET") {
    const p = (
      await rows(
        pool,
        "SELECT email_enabled FROM preferences WHERE user_id=?",
        [u.id],
      )
    )[0];
    return {
      data: {
        emailEnabled: p ? p.email_enabled === 1 : true,
        smtpConfigured: Boolean(process.env.SMTP_HOST),
        recipient: u.email,
      },
    };
  }
  if (p === "/preferencias" && m === "PATCH") {
    if (typeof b.emailEnabled !== "boolean")
      throw new HttpError(400, "Preferencia no válida.");
    await rows(
      pool,
      "INSERT INTO preferences(user_id,email_enabled)VALUES(?,?) ON DUPLICATE KEY UPDATE email_enabled=?",
      [u.id, b.emailEnabled ? 1 : 0, b.emailEnabled ? 1 : 0],
    );
    return { data: { ok: true } };
  }
  if (p === "/leer-todas" && m === "PATCH") {
    await rows(pool, "UPDATE notifications SET leida=1 WHERE user_id=?", [
      u.id,
    ]);
    return { data: { ok: true } };
  }
  if (p.startsWith("/") && m === "PATCH") {
    const result = await rows(
      pool,
      "UPDATE notifications SET leida=1 WHERE id=? AND user_id=?",
      [p.slice(1), u.id],
    );
    if (!result.affectedRows) throw new HttpError(404, "Aviso no encontrado.");
    return { data: { ok: true } };
  }
});
if (process.env.SMTP_HOST) {
  const transport = mailTransport();
  let running = false;
  setInterval(
    async () => {
      if (running) return;
      running = true;
      try {
        await rows(
          pool,
          "UPDATE notifications SET email_status='Pendiente' WHERE email_status='Sin configurar'",
        );
        const pending = await rows(
          pool,
          "SELECT * FROM notifications WHERE email_status='Pendiente' AND (next_attempt_at IS NULL OR next_attempt_at<=UTC_TIMESTAMP()) ORDER BY created_at LIMIT 10",
        );
        for (const n of pending) {
          const pref = (
            await rows(
              pool,
              "SELECT email_enabled FROM preferences WHERE user_id=?",
              [n.user_id],
            )
          )[0];
          if (
            pref?.email_enabled === 0 &&
            ![
              "verification",
              "authentication",
              "appointment",
              "password_reset",
              "password_reset",
            ].includes(n.email_kind)
          ) {
            await rows(
              pool,
              "UPDATE notifications SET email_status='Desactivado',email_text=NULL WHERE id=?",
              [n.id],
            );
            continue;
          }
          try {
            const user = await internal(
              "afiliados",
              `/_internal/usuarios/${n.user_id}`,
            );
            await transport.sendMail({
              from: process.env.MAIL_FROM || process.env.SMTP_USER,
              to: user.email,
              subject: `Virelia: ${n.titulo}`,
              text:
                n.email_text ||
                `Tienes una nueva actualización en Virelia. Inicia sesión para consultarla: ${appUrl()}/#/${n.link}`,
            });
            await rows(
              pool,
              "UPDATE notifications SET email_status='Enviado',email_text=NULL,next_attempt_at=NULL WHERE id=?",
              [n.id],
            );
          } catch (e) {
            console.error("Correo:", e.code || e.name);
            await rows(
              pool,
              "UPDATE notifications SET attempts=attempts+1,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND) WHERE id=?",
              [Math.min(3600, 30 * 2 ** Math.min(n.attempts, 7)), n.id],
            );
            // Continue with other recipients; one failing message must not block the queue.
          }
        }
      } catch (e) {
        console.error("Correo:", e.code || e.name);
      } finally {
        running = false;
      }
    },
    Math.max(200, Number(process.env.SMTP_POLL_MS || 10000)),
  ).unref();
}
