import { rows } from "../../../shared/db.js";
import { sessionToken, tokenHash } from "../../../shared/security.js";
import { event } from "../../../shared/events.js";
import { appUrl, verificationRequired } from "../../../shared/mail.js";
import { HttpError } from "../../../shared/validation.js";

export function requireVerified(user) {
  if (
    (verificationRequired() || process.env.EMAIL_LOGIN_OTP === "true") &&
    !user.email_verified
  ) {
    const e = new HttpError(
      403,
      "Verifica tu correo electrónico antes de ingresar.",
    );
    e.publicCode = "EMAIL_NOT_VERIFIED";
    throw e;
  }
}
export function requireMail() {
  if (!process.env.SMTP_HOST)
    throw new HttpError(
      503,
      "El envío de verificación todavía no está configurado. Contacta al responsable del portal.",
    );
}
export async function queueVerification(conn, userId) {
  requireMail();
  const token = sessionToken();
  await rows(
    conn,
    "INSERT INTO email_verifications(token_hash,user_id,expires_at)VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))",
    [tokenHash(token), userId],
  );
  await event(
    conn,
    userId,
    "Verifica tu correo electrónico",
    "Solicitaste confirmar el correo de tu cuenta.",
    "perfil",
    {
      kind: "verification",
      text: `Confirma tu correo para ingresar a Virelia:\n\n${appUrl()}/#/verificar?token=${token}\n\nEl enlace vence en 30 minutos y sirve una sola vez. Si no solicitaste esta cuenta, ignora este mensaje.\n\nVirelia Health.`,
    },
  );
}
