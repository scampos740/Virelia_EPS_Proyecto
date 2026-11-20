import AtencionClinica from "./AtencionClinica.jsx";
import { useState } from "react";
import { api, send } from "../services/api.js";
import { futureSlot, todayBogota } from "../../../shared/validation.js";
import {
  PageTitle,
  Field,
  Button,
  Alert,
  useLoad,
  LoadState,
  Empty,
  Badge,
  dateLabel,
} from "../components/ui.jsx";
export default function Doctor({ user }) {
  const [clinicalId, setClinicalId] = useState(null);
  const agenda = useLoad(() => api("citas", "/doctor/horarios"));
  const [form, setForm] = useState({
      especialidad: user.especialidad || "",
      sede: "Centro Virelia",
      fecha: "",
      hora: "",
    }),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState(""),
    [pending, setPending] = useState(null);
  const set = (k, v) => setForm({ ...form, [k]: v });
  async function create(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      futureSlot(form);
      setBusy(true);
      await api("citas", "/doctor/horarios", {
        method: "POST",
        body: send(form),
      });
      setMessage("Horario publicado. Ya puede reservarlo un paciente.");
      await agenda.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    setBusy(true);
    setError("");
    try {
      await api("citas", `/doctor/horarios/${id}`, { method: "DELETE" });
      setPending(null);
      setMessage("Horario retirado. Se conserva su historial.");
      await agenda.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const slots = (agenda.data || []).filter(
    (s) => !filter || s.fecha === filter,
  );
  if (clinicalId)
    return (
      <AtencionClinica
        key={clinicalId}
        appointmentId={clinicalId}
        onBack={() => {
          setClinicalId(null);
          agenda.reload();
        }}
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="PORTAL PROFESIONAL"
        title={`Hola, ${user.nombres}.`}
        description="Publica tu disponibilidad y consulta las reservas de tu agenda. Horas de Colombia."
      />
      <Alert>{error}</Alert>
      {!user.especialidad && (
        <Alert>
          Solicita al operador registrar tu especialidad para publicar horarios.
        </Alert>
      )}
      <Alert success>{message}</Alert>
      <div className="two-col">
        <section className="card">
          <h2>Publicar un horario</h2>
          <p>
            La reserva la realiza el paciente. Cada horario admite una sola
            cita.
          </p>
          <form onSubmit={create} className="form-grid">
            <Field
              label="Especialidad"
              id="doctor-specialty"
              value={form.especialidad}
              maxLength={80}
              required
              readOnly
              hint="Asignada por el operador al crear tu perfil."
            />
            <Field
              label="Sede o modalidad"
              id="doctor-site"
              value={form.sede}
              minLength={3}
              maxLength={100}
              required
              onChange={(e) => set("sede", e.target.value)}
            />
            <Field
              label="Fecha"
              id="doctor-date"
              type="date"
              min={todayBogota()}
              required
              value={form.fecha}
              onChange={(e) => set("fecha", e.target.value)}
            />
            <Field
              label="Hora"
              id="doctor-time"
              type="time"
              step="1800"
              required
              value={form.hora}
              onChange={(e) => set("hora", e.target.value)}
            />
            <Button disabled={busy || !user.especialidad} type="submit">
              {busy ? "Guardando…" : "Publicar horario"}
            </Button>
          </form>
        </section>
        <aside className="card">
          <h2>Tu perfil profesional</h2>
          <Badge>Doctor autorizado</Badge>
          <p>Especialidad: {user.especialidad || "Pendiente de asignación"}</p>
          <h3>
            {user.nombres} {user.apellidos}
          </h3>
          <p>{user.email}</p>
          <p>
            Solo puedes administrar tus propios horarios. Un horario reservado
            conserva su información y no se puede retirar desde este panel.
          </p>
          <p className="fine-print">Agenda de atención.</p>
        </aside>
      </div>
      <section className="card spaced-title">
        <div className="page-title">
          <h2>Mi agenda</h2>
          <Button kind="secondary small" onClick={agenda.reload}>
            Actualizar agenda
          </Button>
        </div>
        <Field
          label="Filtrar por fecha"
          id="doctor-filter"
          type="date"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <LoadState resource={agenda}>
          {slots.length ? (
            <div className="appointment-list">
              {slots.map((s) => (
                <article className="card appointment" key={s.id}>
                  <div className="appointment-date">
                    <strong>{dateLabel(s.fecha)}</strong>
                    <span>{s.hora}</span>
                  </div>
                  <div className="appointment-info">
                    <Badge>
                      {s.appointmentId
                        ? "Reservado"
                        : s.available
                          ? "Disponible"
                          : "Retirado"}
                    </Badge>
                    <h3>{s.especialidad}</h3>
                    <p>{s.sede}</p>
                    {s.appointmentId && (
                      <small>
                        {s.paciente_nombre || "Paciente de registro anterior"} ·
                        Reserva: {s.appointmentId.slice(0, 8)}
                      </small>
                    )}
                  </div>
                  {s.appointmentId && (
                    <Button
                      kind="secondary small"
                      onClick={() => setClinicalId(s.appointmentId)}
                    >
                      Registrar atención
                    </Button>
                  )}
                  {s.available === 1 && (
                    <Button
                      kind="secondary small"
                      disabled={busy}
                      onClick={() => setPending(s.id)}
                    >
                      Retirar horario
                    </Button>
                  )}
                  {pending === s.id && (
                    <div
                      className="confirmation"
                      role="alertdialog"
                      aria-label="Retirar horario"
                    >
                      <p>¿Retirar este horario de la disponibilidad?</p>
                      <Button disabled={busy} onClick={() => remove(s.id)}>
                        Confirmar retiro
                      </Button>
                      <Button kind="secondary" onClick={() => setPending(null)}>
                        Conservar
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty icon="calendar" title="Aún no hay horarios">
              Publica tu primer horario para que aparezca en la agenda de
              pacientes.
            </Empty>
          )}
        </LoadState>
      </section>
    </>
  );
}
