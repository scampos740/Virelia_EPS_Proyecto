import { useState } from "react";
import { api, API_BASE_URL } from "../services/api.js";
import {
  PageTitle,
  Alert,
  Button,
  LoadState,
  useLoad,
  Empty,
} from "../components/ui.jsx";
const labels = {
  reason: "Motivo de consulta",
  observations: "Observaciones clínicas",
  diagnosis: "Diagnóstico",
  plan: "Indicaciones y plan de manejo",
};
export function localDate(v) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(v.includes("T") ? v : v.replace(" ", "T") + "Z"));
}
export default function Documentos() {
  const list = useLoad(() => api("documentos", "/")),
    [history, setHistory] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function download(kind) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/documentos/${kind}/pdf`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const b = await res.json();
        throw Error(b.error?.message || "No se pudo generar el documento.");
      }
      const blob = await res.blob(),
        href = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = href;
      a.download =
        kind === "historia"
          ? "historia-clinica.pdf"
          : "certificado-afiliacion.pdf";
      a.click();
      await list.reload();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function view() {
    setBusy(true);
    setError("");
    try {
      setHistory(await api("documentos", "/historia"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="DOCUMENTOS PERSONALES"
        title="Tus documentos de salud"
        description="Consulta tu historia clínica y solicita tu certificado de afiliación. Acceso exclusivo para el titular."
      />
      <Alert>{error}</Alert>
      <LoadState resource={list}>
        <div className="two-col">
          {(list.data || []).map((d) => (
            <section className="card" key={d.type}>
              <h2>{d.title}</h2>
              <p>
                {d.type === "historia"
                  ? "Incluye las atenciones finalizadas y sus adendas, en orden cronológico."
                  : d.available
                    ? `Afiliación registrada desde ${d.date}. La fecha de expedición se incluye al generar el PDF.`
                    : "Tu fecha de afiliación requiere validación por la entidad antes de expedir el certificado."}
              </p>
              <p className="fine-print">
                {d.issuedAt
                  ? `Última expedición: ${localDate(d.issuedAt)}`
                  : "La fecha de expedición se registra al descargar el documento."}
              </p>
              {d.type === "historia" && (
                <Button disabled={busy} kind="secondary" onClick={view}>
                  Consultar historia clínica
                </Button>
              )}
              <Button disabled={busy} onClick={() => download(d.type)}>
                {busy
                  ? "Procesando…"
                  : d.type === "historia"
                    ? "Descargar historia clínica"
                    : "Descargar certificado de afiliación"}
              </Button>
            </section>
          ))}
        </div>
      </LoadState>
      {history && (
        <section className="card spaced-title">
          <h2>
            Historia clínica de {history.patient.nombres}{" "}
            {history.patient.apellidos}
          </h2>
          <p>
            {history.patient.tipoDocumento} {history.patient.documento}
          </p>
          {history.records.length ? (
            history.records.map((r) => (
              <article className="clinical-record" key={r.id}>
                <h3>{localDate(r.attended_at)}</h3>
                <p>Profesional: {r.doctor_name}</p>
                {Object.entries(labels).map(([k, label]) => (
                  <div key={k}>
                    <h4>{label}</h4>
                    <p className="preserve-text">{r[k]}</p>
                  </div>
                ))}
                {r.addenda.map((a, i) => (
                  <aside className="tip-panel" key={i}>
                    <div>
                      <h4>
                        Adenda · {localDate(a.created_at)} · {a.doctor_name}
                      </h4>
                      <p className="preserve-text">{a.content}</p>
                    </div>
                  </aside>
                ))}
              </article>
            ))
          ) : (
            <Empty icon="file" title="Aún no tienes atenciones finalizadas">
              Los borradores del profesional no se incluyen en tu historia
              clínica.
            </Empty>
          )}
        </section>
      )}
    </>
  );
}
