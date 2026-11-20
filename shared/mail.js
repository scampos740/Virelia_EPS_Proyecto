import nodemailer from "nodemailer";
import "./config.js";

export const verificationRequired = () =>
  process.env.REQUIRE_EMAIL_VERIFICATION === "true";
export function appUrl() {
  const u = new URL(process.env.PUBLIC_APP_URL || "http://127.0.0.1:5173");
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw new Error(
      "PUBLIC_APP_URL debe ser la dirección HTTP o HTTPS del portal, sin credenciales ni fragmentos.",
    );
  return u.href.replace(/\/$/, "");
}
export function mailTransport() {
  if (!process.env.SMTP_HOST) throw new Error("Configura SMTP_HOST en .env.");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    ...(process.env.SMTP_HOST === "smtp.gmail.com" ? { requireTLS: true } : {}),
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass:
              process.env.SMTP_HOST === "smtp.gmail.com"
                ? process.env.SMTP_PASSWORD?.replace(/\s/g, "")
                : process.env.SMTP_PASSWORD,
          },
        }
      : {}),
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
}
