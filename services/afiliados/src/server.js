import {
  emailLoginRequired,
  beginLogin,
  cancelPendingLogin,
  loginCookie,
  confirmLogin,
  resendLogin,
} from "./login-code.js";
import { randomUUID } from "node:crypto";
import { rows, transaction } from "../../../shared/db.js";
import { startServer, requireInternal } from "../../../shared/http.js";
import {
  ageAt,
  todayBogota,
  registration,
  identity,
  personName,
  HttpError,
  text,
  email,
  date,
  contact,
  choice,
  requireRow,
} from "../../../shared/validation.js";
import {
  hashPassword,
  verifyPassword,
  sessionToken,
  tokenHash,
  cookieToken,
  sessionCookie,
} from "../../../shared/security.js";
import { event, startOutbox } from "../../../shared/events.js";
import { pool, profile, publicProfile } from "./repositories/profile.js";
import {
  requireVerified,
  requireMail,
  queueVerification,
} from "./verification.js";
import { verificationRequired } from "../../../shared/mail.js";
import { limit } from "../../../shared/limit.js";
import { pqrs } from "./pqrs.js";
import { recovery } from "./recovery.js";
import { audit } from "../../../shared/audit.js";
async function session(req) {
  const token = cookieToken(req);
  const sessions = await rows(
    pool,
    "SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP()",
    [tokenHash(token)],
  );
  if (!sessions[0]) throw new HttpError(401, "Inicia sesión para continuar.");
  const user = requireRow(await profile(sessions[0].user_id));
  requireVerified(user);
  return publicProfile(user);
}
async function loginUser(user, conn = pool) {
  const token = sessionToken();
  await rows(
    conn,
    "INSERT INTO sessions(token_hash,user_id,expires_at)VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))",
    [tokenHash(token), user.id],
  );
  await audit(conn, user.id, "session.create", user.id);
  return { data: publicProfile(user), cookie: sessionCookie(token) };
}
startServer("afiliados", async (req, url, b) => {
  const p = url.pathname,
    m = req.method;
  if (p === "/pqrs" || p.startsWith("/pqrs/"))
    return pqrs(req, new URL(p.slice(5) || "/", url), b);
  if (p.startsWith("/recuperacion/")) return recovery(req, url, b);
  if (p === "/login/confirmar" && m === "POST")
    return confirmLogin(req, b, loginUser);
  if (p === "/login/reenviar" && m === "POST") return resendLogin(req, b);
  if (p === "/verificacion/confirmar" && m === "POST") {
    const token = text(b.token, "Enlace", 64, 64);
    if (!/^[0-9a-f]{64}$/.test(token))
      throw new HttpError(400, "El enlace no es válido.");
    await transaction(pool, async (conn) => {
      const verification = (
        await rows(
          conn,
          "SELECT user_id FROM email_verifications WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE",
          [tokenHash(token)],
        )
      )[0];
      if (!verification)
        throw new HttpError(
          400,
          "El enlace venció o ya fue utilizado. Solicita uno nuevo desde Ingresar.",
        );
      await rows(conn, "UPDATE users SET email_verified=1 WHERE id=?", [
        verification.user_id,
      ]);
      await rows(
        conn,
        "UPDATE email_verifications SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL",
        [verification.user_id],
      );
    });
    return { data: { verified: true } };
  }
  if (p === "/verificacion/reenviar" && m === "POST") {
    await limit(pool, `auth-ip:${req.socket.remoteAddress}`, 60);
    const mail = email(b.email);
    await limit(pool, `verification:${mail}`, 3);
    requireMail();
    await limit(pool, `auth-account:${p}:${mail}`, 10);
    const user = (
      await rows(pool, "SELECT * FROM users WHERE email=?", [mail])
    )[0];
    if (user && !user.email_verified)
      await transaction(pool, (conn) => queueVerification(conn, user.id));
    return {
      data: {
        message:
          "Si la cuenta necesita verificación, recibirás un nuevo enlace en tu correo.",
      },
    };
  }
  if (p === "/registro" && m === "POST") {
    await limit(pool, `registration:${req.socket.remoteAddress}`, 50, 3600);
    if (verificationRequired() || emailLoginRequired()) requireMail();
    const {
      nombres,
      apellidos,
      correo,
      password,
      nacimiento,
      documento,
      tipo,
      ...c
    } = registration(b);
    const id = randomUUID();
    const affiliationDate = todayBogota();
    await transaction(pool, async (conn) => {
      await rows(
        conn,
        "INSERT INTO users(id,email,password_hash,nombres,apellidos,tipo_documento,documento,nacimiento,telefono,direccion,ciudad,affiliation_date)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          id,
          correo,
          hashPassword(password),
          nombres,
          apellidos,
          tipo,
          documento,
          nacimiento,
          c.telefono,
          c.direccion,
          c.ciudad,
          affiliationDate,
        ],
      );
      if (verificationRequired() || emailLoginRequired())
        await queueVerification(conn, id);
      else
        await event(
          conn,
          id,
          "Tu cuenta está lista",
          "Ya puedes explorar el portal.",
          "afiliados",
        );
    });
    if (verificationRequired() || emailLoginRequired())
      return {
        status: 201,
        data: { verificationRequired: true, email: correo },
      };
    return { ...(await loginUser(await profile(id))), status: 201 };
  }
  if (p === "/login" && m === "POST") {
    await limit(pool, `auth-ip:${req.socket.remoteAddress}`, 60);
    const mail = email(b.email),
      pass = text(b.password, "Contraseña", 1, 100);
    await limit(pool, `auth-account:${p}:${mail}`, 10);
    const user = (
      await rows(pool, "SELECT * FROM users WHERE email=?", [mail])
    )[0];
    if (!user || !verifyPassword(pass, user.password_hash))
      throw new HttpError(401, "Correo o contraseña incorrectos.");
    requireVerified(user);

    return emailLoginRequired() ? beginLogin(user) : loginUser(user);
  }
  if (p === "/logout" && m === "POST") {
    await cancelPendingLogin(req);
    await rows(pool, "DELETE FROM sessions WHERE token_hash=?", [
      tokenHash(cookieToken(req)),
    ]);
    return {
      data: { ok: true },
      cookie: [sessionCookie("", 0), loginCookie("", 0)],
    };
  }
  if (p === "/_internal/sesion") {
    requireInternal(req);
    return { data: await session(req) };
  }
  if (p.startsWith("/_internal/usuarios/")) {
    requireInternal(req);
    return {
      data: publicProfile(requireRow(await profile(p.split("/").at(-1)))),
    };
  }
  const user = await session(req);
  if (p === "/me" && m === "GET") return { data: user };
  if (p === "/me" && m === "PATCH") {
    const c = contact(b);
    await transaction(pool, async (conn) => {
      await rows(
        conn,
        "UPDATE users SET telefono=?,direccion=?,ciudad=? WHERE id=?",
        [c.telefono, c.direccion, c.ciudad, user.id],
      );
      await event(
        conn,
        user.id,
        "Datos actualizados",
        "Guardamos tus datos de contacto.",
        "perfil",
      );
    });
    return { data: publicProfile(await profile(user.id)) };
  }
  if (p === "/beneficiarios" && m === "GET")
    return {
      data: await rows(
        pool,
        "SELECT id,nombre,tipo_documento AS tipoDocumento,documento,parentesco,nacimiento FROM beneficiaries WHERE user_id=? ORDER BY nombre",
        [user.id],
      ),
    };
  if (p === "/beneficiarios" && m === "POST") {
    const id = randomUUID(),
      nombre = personName(b.nombre, "Nombre", 150),
      documento = identity(b.tipoDocumento, b.documento, b.nacimiento, true),
      parentesco = choice(
        b.parentesco,
        ["Hijo/a", "Pareja", "Madre/Padre", "Otro"],
        "Parentesco",
      ),
      nacimiento = date(b.nacimiento);
    if (documento === user.documento && b.tipoDocumento === user.tipoDocumento)
      throw new HttpError(400, "El titular ya pertenece a la cuenta.");
    const titularAge = ageAt(user.nacimiento);
    if (
      parentesco === "Hijo/a" &&
      (new Date(nacimiento) <= new Date(user.nacimiento) || titularAge < 12)
    )
      throw new HttpError(
        400,
        "Revisa la fecha de nacimiento y el parentesco.",
      );
    await transaction(pool, async (conn) => {
      await rows(
        conn,
        "INSERT INTO beneficiaries(id,user_id,nombre,tipo_documento,documento,parentesco,nacimiento)VALUES(?,?,?,?,?,?,?)",
        [
          id,
          user.id,
          nombre,
          b.tipoDocumento,
          documento,
          parentesco,
          nacimiento,
        ],
      );
      await event(
        conn,
        user.id,
        "Grupo familiar actualizado",
        "Agregaste un integrante a tu grupo familiar.",
        "perfil",
      );
    });
    return {
      status: 201,
      data: { id, nombre, documento, parentesco, nacimiento },
    };
  }
  if (p.startsWith("/beneficiarios/") && m === "DELETE") {
    const result = await rows(
      pool,
      "DELETE FROM beneficiaries WHERE id=? AND user_id=?",
      [p.split("/").at(-1), user.id],
    );
    if (!result.affectedRows)
      throw new HttpError(404, "Integrante no encontrado.");
    return { data: { ok: true } };
  }
});
startOutbox(pool);
