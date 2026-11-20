export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export async function api(service, path = "", options = {}) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${API_BASE_URL}/${service}${path || "/"}`, {
      ...options,
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    let body;
    try {
      body = await res.json();
    } catch {
      const error = new Error(
        "El servicio no está disponible. Puedes usar las otras secciones del portal.",
      );
      error.status = 503;
      throw error;
    }
    if (!res.ok) {
      const e = new Error(
        body.error?.message || "No pudimos completar la solicitud.",
      );
      e.status = res.status;
      e.code = body.error?.code;
      throw e;
    }
    return body.data;
  } catch (e) {
    if (e.name === "AbortError" || e instanceof TypeError)
      throw new Error(
        "No pudimos conectar. Inténtalo de nuevo en unos momentos.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export const send = (body) => JSON.stringify(body);
