import { useState, useEffect } from "react";
import { api, send } from "../services/api.js";
import { Field, Button, Alert } from "../components/ui.jsx";
export default function CodigoAcceso({ challenge, onLogin, onBack }) {
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(
      "Solicitamos tu código. Revisa también spam.",
    ),
    [wait, setWait] = useState(challenge.resendAfter || 60);
  useEffect(() => {
    const timer = setInterval(() => setWait((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  async function confirm(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("Escribe los seis dígitos del correo.");
      return;
    }
    setBusy(true);
    try {
      const user = await api("afiliados", "/login/confirmar", {
        method: "POST",
        body: send({ challengeId: challenge.challengeId, code }),
      });
      onLogin(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    try {
      const r = await api("afiliados", "/login/reenviar", {
        method: "POST",
        body: send({ challengeId: challenge.challengeId }),
      });
      setWait(r.resendAfter);
      setNotice(r.message);
      setCode("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="access-layout container">
      <div className="access-copy">
        <p className="eyebrow">UN PASO MÁS</p>
        <h1>Confirma que eres tú.</h1>
        <p>
          Tu contraseña ya fue comprobada. Para abrir la sesión, escribe el
          código enviado al correo de tu cuenta.
        </p>
      </div>
      <form className="card access-form" onSubmit={confirm}>
        <h2>Código de acceso</h2>
        <p>
          Correo: <strong>{challenge.email}</strong>
        </p>
        <Alert>{error}</Alert>
        <Alert success>{notice}</Alert>
        <Field
          label="Código de seis dígitos"
          id="login-code"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
        />
        <p className="fine-print">
          Vence en cinco minutos y solo se usa una vez. No compartas el código.
          Si pediste otro, usa el más reciente.
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? "Un momento…" : "Confirmar e ingresar"}
        </Button>
        <Button
          type="button"
          kind="secondary"
          disabled={busy || wait > 0}
          onClick={resend}
        >
          {wait > 0 ? `Reenviar en ${wait} s` : "Reenviar código"}
        </Button>
        <Button type="button" kind="ghost" disabled={busy} onClick={onBack}>
          Volver al acceso
        </Button>
      </form>
    </section>
  );
}
