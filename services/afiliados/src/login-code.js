import { randomInt, createHmac } from "node:crypto";
import { rows, transaction } from "../../../shared/db.js";
import { internalKey } from "../../../shared/config.js";
import {
  sessionToken,
  tokenHash,
  equalSecret,
} from "../../../shared/security.js";
import { HttpError, text } from "../../../shared/validation.js";
import { event } from "../../../shared/events.js";
import { requireMail } from "./verification.js";
import { pool, profile } from "./repositories/profile.js";
export const emailLoginRequired = () => process.env.EMAIL_LOGIN_OTP === "true";
export const loginCodeHash = (challenge, code) =>
  createHmac("sha256", internalKey)
    .update(`${challenge}:${code}`)
    .digest("hex");
export function loginCookie(value, maxAge = 300) {
  return `virelia_login=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`;
}
function binding(req) {
  return (
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("virelia_login="))
      ?.slice(14) || ""
  );
}
async function sendCode(c, userId, challenge, previousHash = "") {
  let code;
  do {
    code = String(randomInt(0, 1000000)).padStart(6, "0");
  } while (
    previousHash &&
    equalSecret(loginCodeHash(challenge, code), previousHash)
  );
  await event(
    c,
    userId,
    "Código para iniciar sesión",
    "Solicitaste un código para acceder a tu cuenta.",
    "login",
    {
      kind: "authentication",
      text: `Tu código para iniciar sesión en Virelia es: ${code}\n\nVence en 5 minutos y solo se puede usar una vez. No compartas este código. Si no intentaste ingresar, ignora este correo.`,
    },
  );
  return loginCodeHash(challenge, code);
}
export async function beginLogin(user) {
  requireMail();
  const challenge = sessionToken(),
    browser = sessionToken();
  await transaction(pool, async (c) => {
    await rows(c, "SELECT id FROM users WHERE id=? FOR UPDATE", [user.id]);
    const recent = await rows(
      c,
      "SELECT id_hash FROM login_challenges WHERE user_id=? AND created_at>DATE_SUB(CURRENT_TIMESTAMP(),INTERVAL 15 MINUTE)",
      [user.id],
    );
    if (recent.length >= 3)
      throw new HttpError(
        429,
        "Solicitaste varios códigos. Espera 15 minutos antes de iniciar otro acceso.",
      );
    await rows(
      c,
      "UPDATE login_challenges SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL",
      [user.id],
    );
    const hash = await sendCode(c, user.id, challenge);
    await rows(
      c,
      "INSERT INTO login_challenges(id_hash,user_id,browser_hash,code_hash,expires_at,last_sent_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE),UTC_TIMESTAMP())",
      [tokenHash(challenge), user.id, tokenHash(browser), hash],
    );
  });
  return {
    data: {
      loginCodeRequired: true,
      challengeId: challenge,
      email: user.email,
      expiresIn: 300,
      resendAfter: 60,
    },
    cookie: loginCookie(browser),
  };
}
async function challengeRow(c, req, challenge) {
  const row = (
    await rows(
      c,
      "SELECT *,expires_at>UTC_TIMESTAMP() AS valid,last_sent_at<=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 60 SECOND) AS can_resend FROM login_challenges WHERE id_hash=? FOR UPDATE",
      [tokenHash(challenge)],
    )
  )[0];
  if (
    !row ||
    row.used_at ||
    !row.valid ||
    !equalSecret(row.browser_hash, tokenHash(binding(req)))
  )
    throw new HttpError(
      400,
      "El código venció, ya fue usado o pertenece a otro navegador. Inicia sesión nuevamente.",
    );
  if (row.attempts >= 5)
    throw new HttpError(
      429,
      "Se agotaron los cinco intentos. Inicia sesión nuevamente.",
    );
  return row;
}
function challengeId(b) {
  const id = text(b.challengeId, "Solicitud", 64, 64);
  if (!/^[a-f0-9]{64}$/.test(id))
    throw new HttpError(400, "La solicitud no es válida.");
  return id;
}
export async function confirmLogin(req, b, openSession) {
  const challenge = challengeId(b),
    code = text(b.code, "Código", 6, 6);
  if (!/^\d{6}$/.test(code))
    throw new HttpError(400, "Escribe el código de seis dígitos.");
  const result = await transaction(pool, async (c) => {
    const row = await challengeRow(c, req, challenge);
    if (!equalSecret(row.code_hash, loginCodeHash(challenge, code))) {
      await rows(
        c,
        "UPDATE login_challenges SET attempts=attempts+1 WHERE id_hash=?",
        [row.id_hash],
      );
      return { invalid: true, remaining: 4 - row.attempts };
    }
    const user = await profile(row.user_id, c);
    if (!user || !user.email_verified)
      throw new HttpError(403, "La cuenta no permite iniciar sesión.");
    await rows(
      c,
      "UPDATE login_challenges SET used_at=UTC_TIMESTAMP(),code_hash=? WHERE id_hash=?",
      ["", row.id_hash],
    );
    const session = await openSession(user, c);
    session.cookie = [session.cookie, loginCookie("", 0)];
    return session;
  });
  // Invalid attempts must commit before returning an error, otherwise rollback resets the limit.
  if (result.invalid)
    throw new HttpError(
      result.remaining === 0 ? 429 : 400,
      result.remaining === 0
        ? "Se agotaron los cinco intentos. Inicia sesión nuevamente."
        : `Código incorrecto. Quedan ${result.remaining} intentos.`,
    );
  return result;
}
export async function resendLogin(req, b) {
  requireMail();
  const challenge = challengeId(b);
  await transaction(pool, async (c) => {
    const row = await challengeRow(c, req, challenge);
    if (!row.can_resend)
      throw new HttpError(
        429,
        "Espera 60 segundos antes de reenviar el código.",
      );
    if (row.send_count >= 3)
      throw new HttpError(
        429,
        "Ya se enviaron tres códigos para este acceso. Inicia sesión nuevamente.",
      );
    const hash = await sendCode(c, row.user_id, challenge, row.code_hash);
    await rows(
      c,
      "UPDATE login_challenges SET code_hash=?,send_count=send_count+1,last_sent_at=UTC_TIMESTAMP(),expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE) WHERE id_hash=?",
      [hash, row.id_hash],
    );
  });
  return {
    data: {
      message:
        "Solicitamos un nuevo código. Usa únicamente el último correo recibido.",
      expiresIn: 300,
      resendAfter: 60,
    },
    cookie: loginCookie(binding(req)),
  };
}

export async function cancelPendingLogin(req) {
  const browser = binding(req);
  if (browser)
    await rows(
      pool,
      "UPDATE login_challenges SET used_at=UTC_TIMESTAMP(),code_hash='' WHERE browser_hash=? AND used_at IS NULL",
      [tokenHash(browser)],
    );
}
