export function validateProduction() {
  if (process.env.NODE_ENV !== "production") return;
  for (const key of [
    "PUBLIC_APP_URL",
    "INTERNAL_API_KEY",
    "DB_HOST",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
  ])
    if (!process.env[key])
      throw new Error(`Falta configuración de producción: ${key}`);
  const site = new URL(process.env.PUBLIC_APP_URL);
  if (
    site.protocol !== "https:" ||
    /^(localhost|127\.|0\.)/.test(site.hostname)
  )
    throw new Error("Producción requiere PUBLIC_APP_URL HTTPS público.");
  if (
    process.env.COOKIE_SECURE !== "true" ||
    process.env.REQUIRE_EMAIL_VERIFICATION !== "true" ||
    process.env.EMAIL_LOGIN_OTP !== "true" ||
    process.env.DB_TLS !== "true" ||
    process.env.SEED_DEMO !== "false"
  )
    throw new Error(
      "Producción requiere cookies seguras, verificación, dos pasos, TLS MySQL y SEED_DEMO=false.",
    );
  for (const domain of ["AFILIADOS", "CITAS", "DOCUMENTOS", "NOTIFICACIONES"])
    if (
      !process.env[`${domain}_DB_USER`] ||
      !process.env[`${domain}_DB_PASSWORD`]
    )
      throw new Error(`Falta usuario limitado: ${domain}`);
}
