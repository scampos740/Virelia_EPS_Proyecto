import { pool } from "./repositories/profile.js";
import { rows, transaction } from "../../../shared/db.js";
import {
  text,
  email,
  password,
  HttpError,
} from "../../../shared/validation.js";
import {
  sessionToken,
  tokenHash,
  hashPassword,
  sessionCookie,
} from "../../../shared/security.js";
import { loginCookie } from "./login-code.js";
import { event } from "../../../shared/events.js";
import { appUrl } from "../../../shared/mail.js";
import { requireMail } from "./verification.js";
import { limit } from "../../../shared/limit.js";
import { audit } from "../../../shared/audit.js";
export async function recovery(req, url, b) {
  if (req.method !== "POST") return;
  if (url.pathname === "/recuperacion/solicitar") {
    const mail = email(b.email);
    await limit(pool, `reset-ip:${req.socket.remoteAddress}`, 30);
    await limit(pool, `reset:${mail}`, 3);
    requireMail();
    const [u] = await rows(pool, "SELECT id FROM users WHERE email=?", [mail]);
    if (u) {
      const token = sessionToken();
      await transaction(pool, async (c) => {
        await rows(
          c,
          "UPDATE password_resets SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL",
          [u.id],
        );
        await rows(
          c,
          "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))",
          [tokenHash(token), u.id],
        );
        await event(
          c,
          u.id,
          "Recuperación de contraseña",
          "Solicitaste recuperar el acceso a tu cuenta.",
          "login",
          {
            kind: "password_reset",
            text: `Para cambiar tu contraseña abre este enlace dentro de 15 minutos:\n${appUrl()}/#/restablecer?token=${token}\nSi no lo solicitaste, ignora este mensaje.`,
          },
        );
        await audit(c, u.id, "password.reset.request", u.id);
      });
    }
    return {
      data: {
        message:
          "Si existe una cuenta con ese correo, recibirás un enlace de recuperación.",
      },
    };
  }
  if (url.pathname === "/recuperacion/confirmar") {
    await limit(pool, `reset-confirm:${req.socket.remoteAddress}`, 30);
    const token = text(b.token, "Enlace", 64, 64);
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new HttpError(
        400,
        "El enlace es inválido, venció o ya fue utilizado.",
      );
    const pass = password(b.password);
    if (pass !== b.confirmPassword)
      throw new HttpError(400, "Las contraseñas no coinciden.");
    const hashed = hashPassword(pass);
    await transaction(pool, async (c) => {
      const [r] = await rows(
        c,
        "SELECT user_id FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE",
        [tokenHash(token)],
      );
      if (!r)
        throw new HttpError(
          400,
          "El enlace es inválido, venció o ya fue utilizado. Solicita uno nuevo.",
        );
      await rows(c, "UPDATE users SET password_hash=? WHERE id=?", [
        hashed,
        r.user_id,
      ]);
      await rows(
        c,
        "UPDATE password_resets SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL",
        [r.user_id],
      );
      await rows(c, "DELETE FROM sessions WHERE user_id=?", [r.user_id]);
      await rows(
        c,
        "UPDATE login_challenges SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL",
        [r.user_id],
      );
      await audit(c, r.user_id, "password.reset.complete", r.user_id);
    });
    return {
      data: { message: "Contraseña actualizada. Inicia sesión nuevamente." },
      cookie: [sessionCookie("", 0), loginCookie("", 0)],
    };
  }
}
