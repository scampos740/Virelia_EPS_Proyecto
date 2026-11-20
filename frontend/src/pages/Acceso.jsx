import CodigoAcceso from "./CodigoAcceso.jsx";
import {
  registration,
  documentRules,
  todayBogota,
} from "../../../shared/validation.js";
import { useState } from "react";
import { api, send } from "../services/api.js";
import { Field, Button, Alert, Link, Icon } from "../components/ui.jsx";
export default function Acceso({
  register,
  professional,
  onNavigate,
  onLogin,
}) {
  const [form, setForm] = useState({
      email: "",
      password: "",
      nombres: "",
      apellidos: "",
      tipoDocumento: "CC",
      documento: "",
      nacimiento: "",
      telefono: "",
      direccion: "",
      ciudad: "",
      consentimiento: false,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [challenge, setChallenge] = useState(null),
    [verificationEmail, setVerificationEmail] = useState(""),
    [notice, setNotice] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) {
      setError("El correo y la contraseña son obligatorios.");
      return;
    }
    setBusy(true);
    try {
      if (register) registration(form);
      const u = await api("afiliados", register ? "/registro" : "/login", {
        method: "POST",
        body: send(
          register ? form : { email: form.email, password: form.password },
        ),
      });
      if (u?.loginCodeRequired) {
        setChallenge(u);
        setForm((f) => ({ ...f, password: "" }));
      } else if (u?.verificationRequired) {
        setVerificationEmail(u.email);
        setNotice(
          "Solicitamos el envío del enlace. Revisa tu correo y la carpeta de spam.",
        );
        setForm((f) => ({ ...f, password: "" }));
      } else onLogin(u);
    } catch (e) {
      setError(e.message);
      if (e.code === "EMAIL_NOT_VERIFIED") setVerificationEmail(form.email);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("afiliados", "/verificacion/reenviar", {
        method: "POST",
        body: send({ email: verificationEmail }),
      });
      setNotice(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const input = (k, label, type = "text") => (
    <Field
      key={k}
      id={`access-${k}`}
      label={label}
      type={type}
      value={form[k]}
      onChange={(e) => set(k, e.target.value)}
      required
      {...(register
        ? {
            nombres: { maxLength: 100 },
            apellidos: { maxLength: 100 },
            email: { maxLength: 200 },
            password: { minLength: 8, maxLength: 100 },
            documento: {
              inputMode: "numeric",
              pattern: "[0-9]+",
              minLength: documentRules[form.tipoDocumento].min,
              maxLength: documentRules[form.tipoDocumento].max,
            },
            nacimiento: { min: "1900-01-01", max: todayBogota() },
            telefono: { inputMode: "tel", maxLength: 13 },
            direccion: { minLength: 5, maxLength: 200 },
            ciudad: { maxLength: 100 },
          }[k] || {}
        : {})}
      autoComplete={
        k === "email"
          ? "email"
          : k === "password"
            ? register
              ? "new-password"
              : "current-password"
            : undefined
      }
    />
  );
  if (challenge)
    return (
      <CodigoAcceso
        challenge={challenge}
        onLogin={onLogin}
        onBack={() => {
          setChallenge(null);
          setError("");
        }}
      />
    );
  if (verificationEmail)
    return (
      <section className="access-layout container">
        <div className="access-copy">
          <p className="eyebrow">CONFIRMA TU DIRECCIÓN</p>
          <h1>Revisa tu correo.</h1>
          <p>
            Abre el enlace de Virelia para confirmar tu cuenta y después ingresa
            con tu contraseña.
          </p>
        </div>
        <div className="card access-form">
          <h2>Verifica tu correo electrónico</h2>
          <p>
            Dirección: <strong>{verificationEmail}</strong>
          </p>
          <Alert>{error}</Alert>
          <Alert success>{notice}</Alert>
          <p>
            El enlace vence en 30 minutos. Revisa también spam o solicita uno
            nuevo.
          </p>
          <Button disabled={busy} onClick={resend}>
            {busy ? "Solicitando…" : "Reenviar enlace"}
          </Button>
          <Button
            kind="secondary"
            onClick={() => {
              setVerificationEmail("");
              setError("");
              setNotice("");
              onNavigate("login");
            }}
          >
            Volver a ingresar
          </Button>
        </div>
      </section>
    );
  return (
    <section className="access-layout container">
      <div className="access-copy">
        <p className="eyebrow">
          {professional ? "ACCESO PROFESIONAL" : "TU ESPACIO PERSONAL"}
        </p>
        <h1>
          {register
            ? "Empieza a sentirte más cerca."
            : "Qué bueno verte de nuevo."}
        </h1>
        <p>
          Tus servicios, tus datos y tus trámites. Una cuenta para tenerlos
          siempre a mano.
        </p>
        <div className="access-security">
          <Icon name="shield" size={30} />
          <p>
            Solo tú puedes consultar tus citas y solicitudes desde tu cuenta.
          </p>
        </div>
      </div>
      <form noValidate onSubmit={submit} className="card access-form">
        <h2>
          {register
            ? "Crea tu cuenta"
            : professional
              ? "Ingresa como doctor"
              : "Ingresa a tu portal"}
        </h2>
        <p className="muted">
          Ingresa con tu correo registrado para acceder a tus servicios.
        </p>
        <Alert>{error}</Alert>
        {register && (
          <div className="form-grid">
            {input("nombres", "Nombres")}
            {input("apellidos", "Apellidos")}
            <Field label="Tipo de documento" id="access-tipo">
              <select
                id="access-tipo"
                value={form.tipoDocumento}
                onChange={(e) => set("tipoDocumento", e.target.value)}
              >
                {["CC", "TI", "CE", "PPT"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            {input("documento", "Número de documento")}
            <small>
              {documentRules[form.tipoDocumento].hint} Validación de formato,
              sin consultar bases oficiales.
            </small>
            {input("nacimiento", "Fecha de nacimiento", "date")}
            {input("telefono", "Teléfono")}
            {input("direccion", "Dirección")}
            {input("ciudad", "Ciudad")}
          </div>
        )}
        {input("email", "Correo electrónico", "email")}
        {input("password", "Contraseña", "password")}
        {register && (
          <>
            <small>
              Mínimo 8 caracteres con mayúscula, minúscula y número; sin
              espacios.
            </small>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.consentimiento}
                onChange={(e) => set("consentimiento", e.target.checked)}
              />
              Autorizo el tratamiento de mis datos para gestionar mi cuenta y
              los servicios solicitados.
            </label>
          </>
        )}
        <Button disabled={busy} type="submit">
          {busy ? "Un momento…" : register ? "Crear mi cuenta" : "Ingresar"}
          <Icon name="arrow" size={18} />
        </Button>
        {!professional && (
          <p>
            {register ? "¿Ya tienes una cuenta?" : "¿Aún no tienes cuenta?"}{" "}
            <Link to={register ? "login" : "registro"} onNavigate={onNavigate}>
              {register ? "Ingresar" : "Crear cuenta"}
            </Link>
          </p>
        )}
        {!register && (
          <p>
            <Link
              to={professional ? "login" : "doctor-login"}
              onNavigate={onNavigate}
            >
              {professional
                ? "Acceso de pacientes"
                : "Soy profesional de salud"}
            </Link>
          </p>
        )}
        {!register && (
          <p>
            <Link to="recuperar" onNavigate={onNavigate}>
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        )}
      </form>
    </section>
  );
}
