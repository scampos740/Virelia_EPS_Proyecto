process.env.API_ONLY = "true";
process.env.SERVE_FRONTEND = "true";
await import("./dev.mjs");
