import { useState } from "react";
import { api, send } from "../services/api.js";
import { Field, Button, Alert, LoadState, useLoad } from "../components/ui.jsx";
import { localDate } from "./Documentos.jsx";
export default function AtencionClinica({ appointmentId, onBack }) {
  const resource = useLoad(() =>
      api("citas", `/doctor/atenciones/${appointmentId}`),
    ),
    [form, setForm] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [adenda, setAdenda] = useState(""),
    [confirm, setConfirm] = useState(false);
  const r = resource.data,
    values = form ||
      r?.record || { reason: "", observations: "", diagnosis: "", plan: "" },
    final = r?.record?.status === "Finalizada";
  async function perform(action) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(
        "citas",
        `/doctor/atenciones/${appointmentId}${action ? "/" + action : ""}`,
        {
          method: action ? "POST" : "PUT",
          body: send(
            action === "adendas"
              ? { content: adenda }
              : action
                ? {}
                : { ...values, version: r?.record?.version },
          ),
        },
      );
      setForm(null);
      setAdenda("");
      setConfirm(false);
      await resource.reload();
      setMessage(
        action === "finalizar"
          ? "Atención finalizada. Las correcciones posteriores se registran como adendas."
          : "Información guardada.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <Button kind="secondary" onClick={onBack}>
        Volver a la agenda
      </Button>
      <h2>Registro de atención clínica</h2>
      <Alert>{error}</Alert>
      <Alert success>{message}</Alert>
      <LoadState resource={resource}>
        {r && (
          <>
            <p>
              Paciente: <strong>{r.appointment.paciente_nombre}</strong>
            </p>
            <p>
              Cita: {r.appointment.fecha} · {r.appointment.hora} (Colombia)
            </p>
            <p>Estado: {r.record?.status || "Sin registro"}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perform("");
              }}
            >
              {Object.entries({
                reason: "Motivo de consulta",
                observations: "Observaciones clínicas",
                diagnosis: "Diagnóstico",
                plan: "Indicaciones y plan de manejo",
              }).map(([k, label]) => (
                <div className="field" key={k}>
                  <label htmlFor={`clinical-${k}`}>{label}</label>
                  <textarea
                    id={`clinical-${k}`}
                    maxLength={6000}
                    rows={4}
                    readOnly={final}
                    value={values[k]}
                    onChange={(e) => (
                      setForm({ ...values, [k]: e.target.value }),
                      setConfirm(false)
                    )}
                  />
                </div>
              ))}
              {!final && (
                <>
                  <p>
                    Puedes guardar campos incompletos en borrador. Para
                    finalizar, registra los cuatro campos con información
                    sustentada en la atención.
                  </p>
                  <Button disabled={busy} type="submit">
                    Guardar borrador
                  </Button>
                  <Button
                    type="button"
                    disabled={busy || !r.record || Boolean(form)}
                    kind="secondary"
                    onClick={() => setConfirm(true)}
                  >
                    Finalizar atención
                  </Button>
                  {confirm && (
                    <div role="alertdialog" aria-label="Finalizar atención">
                      <p>
                        Al finalizar, el registro original quedará protegido y
                        estará disponible para el paciente. ¿Confirmas?
                      </p>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => perform("finalizar")}
                      >
                        Confirmar finalización
                      </Button>
                      <Button
                        type="button"
                        kind="secondary"
                        onClick={() => setConfirm(false)}
                      >
                        Volver al borrador
                      </Button>
                    </div>
                  )}
                </>
              )}
            </form>
            {final && (
              <>
                <h3>Adendas</h3>
                {r.addenda.map((a) => (
                  <article key={a.id}>
                    <p>
                      {localDate(a.created_at)} · {a.doctor_name}
                    </p>
                    <p className="preserve-text">{a.content}</p>
                  </article>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    perform("adendas");
                  }}
                >
                  <label htmlFor="clinical-adenda">
                    Nueva adenda o corrección
                  </label>
                  <textarea
                    id="clinical-adenda"
                    required
                    minLength={5}
                    maxLength={6000}
                    rows={4}
                    value={adenda}
                    onChange={(e) => setAdenda(e.target.value)}
                  />
                  <Button disabled={busy} type="submit">
                    Registrar adenda
                  </Button>
                </form>
              </>
            )}
          </>
        )}
      </LoadState>
    </section>
  );
}
