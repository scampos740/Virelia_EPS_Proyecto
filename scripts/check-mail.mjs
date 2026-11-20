import { mailTransport } from "../shared/mail.js";
try {
  if (
    process.env.SMTP_HOST === "smtp.gmail.com" &&
    (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD)
  )
    throw new Error(
      "Completa SMTP_USER y SMTP_PASSWORD con tu Gmail y una contraseña de aplicación.",
    );
  const transport = mailTransport();
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
  console.log(
    "Conexión y autenticación SMTP correctas. No se ha enviado ningún correo de prueba.",
  );
  console.log(
    "Comprueba MAIL_FROM y crea una cuenta con tu correo real o reserva una cita nueva para probar la entrega.",
  );
} catch (e) {
  console.error(
    `SMTP: ${e.code || "CONFIGURACION"}. ${e.code === "EAUTH" ? "Revisa la contraseña de aplicación de Google y la verificación en dos pasos." : e.code ? "Revisa el servidor, puerto, TLS y conexión a Internet." : e.message}`,
  );
  process.exitCode = 1;
}
