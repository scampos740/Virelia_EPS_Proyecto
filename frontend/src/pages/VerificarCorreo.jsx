import { useState } from "react";
import { api, send } from "../services/api.js";
import { Button, Alert, Link, Icon } from "../components/ui.jsx";

export default function VerificarCorreo({ onNavigate }) {
  const token = new URLSearchParams(
    window.location.hash.split("?")[1] ||
      window.location.search.replace(/^\?/, ""),
  ).get("token");
  const [busy, setBusy] = useState(false),
    [verified, setVerified] = useState(false),
    [error, setError] = useState("");
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await api("afiliados", "/verificacion/confirmar", {
        method: "POST",
        body: send({ token }),
      });
      setVerified(true);
      window.history.replaceState(null, "", "#/verificar");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="access-layout container">
      <div className="access-copy">
        <p className="eyebrow">TU CUENTA VIRELIA</p>
        <h1>Confirma tu correo.</h1>
        <p>
          Confirmar esta dirección te permite ingresar a tu espacio personal.
        </p>
      </div>
      <div className="card access-form">
        <Icon name="shield" size={32} />
        <h2>{verified ? "Correo verificado" : "Verificación de correo"}</h2>
        <Alert>{error}</Alert>
        {verified ? (
          <>
            <p>
              Tu correo quedó confirmado. Ya puedes ingresar con tu contraseña.
            </p>
            <Link to="login" onNavigate={onNavigate} className="button">
              Ingresar a mi cuenta
            </Link>
          </>
        ) : token ? (
          <>
            <p>El enlace vence en 30 minutos y sirve una sola vez.</p>
            <Button onClick={confirm} disabled={busy}>
              {busy ? "Verificando…" : "Confirmar mi correo"}
            </Button>
          </>
        ) : (
          <p>
            No encontramos un enlace de verificación. Ingresa para solicitar uno
            nuevo.
          </p>
        )}
        {!verified && (
          <p>
            <Link to="login" onNavigate={onNavigate}>
              Ir a Ingresar y solicitar otro enlace
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
