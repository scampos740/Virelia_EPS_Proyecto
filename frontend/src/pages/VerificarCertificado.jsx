import { useState } from "react";
import { api, send } from "../services/api.js";
import { PageTitle, Field, Button, Alert } from "../components/ui.jsx";
export default function VerificarCertificado() {
  const [file, setFile] = useState(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function check(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!file || file.size > 10 * 1024 * 1024)
        throw Error("Selecciona un PDF de hasta 10 MB.");
      const bytes = await file.arrayBuffer(),
        digest = await crypto.subtle.digest("SHA-256", bytes),
        pdfHash = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
      const r = await api("documentos", "/verificar", {
        method: "POST",
        body: send({ code: code.trim(), pdfHash }),
      });
      if (!r.valid)
        throw Error(
          "No se pudo confirmar la autenticidad: revisa el código y el archivo original.",
        );
      setMessage(
        "Autenticidad confirmada. La huella del archivo coincide con el certificado expedido por la plataforma.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container">
      <PageTitle
        eyebrow="VERIFICACIÓN DOCUMENTAL"
        title="Verificar un certificado"
        description="El archivo se procesa en tu navegador. Solo enviamos su huella digital y el código; no se publica información del afiliado."
      />
      <div className="card">
        <Alert>{error}</Alert>
        <Alert success>{message}</Alert>
        <form onSubmit={check}>
          <Field
            label="Certificado original en PDF"
            id="verify-file"
            type="file"
            accept="application/pdf"
            required
            onChange={(e) => setFile(e.target.files[0])}
          />
          <Field
            label="Código único del certificado"
            id="verify-code"
            required
            minLength={64}
            maxLength={64}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Verificando…" : "Comprobar autenticidad"}
          </Button>
        </form>
      </div>
    </section>
  );
}
