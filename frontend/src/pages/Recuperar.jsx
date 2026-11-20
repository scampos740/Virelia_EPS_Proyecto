import { useState } from "react";
import { api, send } from "../services/api.js";
import { Field, Button, Alert, PageTitle, Link } from "../components/ui.jsx";
export default function Recuperar({ reset, onNavigate }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = new URLSearchParams(
        window.location.hash.split("?")[1] ||
          window.location.search.replace(/^\?/, ""),
      ).get("token");
      const r = await api(
        "afiliados",
        reset ? "/recuperacion/confirmar" : "/recuperacion/solicitar",
        {
          method: "POST",
          body: send(reset ? { token, password, confirmPassword } : { email }),
        },
      );
      setMessage(r.message);
      setPassword("");
      setConfirm("");
      if (reset) window.history.replaceState(null, "", "#/restablecer");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container auth-section">
      <div className="card">
        <PageTitle
          eyebrow="ACCESO SEGURO"
          title={reset ? "Establecer nueva contraseña" : "Recuperar tu acceso"}
          description={
            reset
              ? "El enlace es personal y tiene una vigencia de 15 minutos."
              : "Te enviaremos las instrucciones al correo registrado."
          }
        />
        <Alert>{error}</Alert>
        <Alert success>{message}</Alert>
        <form onSubmit={submit}>
          {reset ? (
            <>
              <Field
                label="Nueva contraseña"
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={100}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p>Usa mayúscula, minúscula y número, sin espacios.</p>
              <Field
                label="Confirmar contraseña"
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </>
          ) : (
            <Field
              label="Correo registrado"
              id="recovery-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <Button type="submit" disabled={busy || Boolean(reset && message)}>
            {busy
              ? "Procesando…"
              : reset
                ? "Guardar contraseña"
                : "Enviar instrucciones"}
          </Button>
        </form>
        <Link to="login" onNavigate={onNavigate}>
          Volver a iniciar sesión
        </Link>
      </div>
    </section>
  );
}
