export const securityHeaders = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Content-Security-Policy":
    "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
});

export function setSecurityHeaders(response) {
  if (process.env.NODE_ENV === "production")
    response.setHeader("Strict-Transport-Security", "max-age=31536000");
  for (const [name, value] of Object.entries(securityHeaders))
    response.setHeader(name, value);
}
