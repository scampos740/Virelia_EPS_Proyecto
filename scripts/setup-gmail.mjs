import { readFileSync, writeFileSync, existsSync } from "node:fs";
import nodemailer from "nodemailer";
import { email } from "../shared/validation.js";
import { appUrl } from "../shared/mail.js";
import { ask, finish } from "./prompt.mjs";
try {
  const file = new URL("../.env", import.meta.url);
  if (!existsSync(file)) throw new Error("Ejecuta npm run setup primero.");
  const user = email(await ask("Cuenta Gmail remitente: "));
  const pass = (
    await ask(
      "Contraseña de aplicación Google (oculta, no la contraseña normal): ",
      true,
    )
  ).replace(/\s/g, "");
  if (!/^[a-zA-Z0-9]{16}$/.test(pass))
    throw new Error(
      "Usa la contraseña de aplicación de 16 caracteres de Google.",
    );
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
  let content = readFileSync(file, "utf8");
  const values = {
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "587",
    SMTP_SECURE: "false",
    SMTP_USER: user,
    SMTP_PASSWORD: pass,
    MAIL_FROM: `Virelia <${user}>`,
    REQUIRE_EMAIL_VERIFICATION: "true",
    EMAIL_LOGIN_OTP: "true",
    PUBLIC_APP_URL: appUrl(),
  };
  for (const [k, v] of Object.entries(values)) {
    const regex = new RegExp(`^${k}=.*$`, "m");
    content = regex.test(content)
      ? content.replace(regex, `${k}=${v}`)
      : `${content}\n${k}=${v}\n`;
  }
  writeFileSync(file, content, { mode: 0o600 });
  console.log(
    "Gmail autenticado y configuración guardada. No se enviaron correos de prueba. Reinicia npm run dev. Crea una cuenta con un correo real para comprobar el enlace.",
  );
} catch (e) {
  console.error(
    e.code === "EAUTH"
      ? "Google rechazó la credencial. Revisa la contraseña de aplicación y la verificación en dos pasos."
      : e.message,
  );
  process.exitCode = 1;
} finally {
  finish();
}
