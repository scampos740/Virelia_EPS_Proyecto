import { useState } from "react";
import {
  PageTitle,
  Icon,
  Link,
  Button,
  Alert,
  Field,
} from "../components/ui.jsx";
export default function Nosotros({ onNavigate }) {
  const [tab, setTab] = useState("esencia"),
    [message, setMessage] = useState("");
  return (
    <section className="container about-page">
      <PageTitle
        eyebrow="CONOCE VIRELIA"
        title="La salud también se construye con confianza."
        description="Un portal que pone a las personas en el centro de su experiencia digital."
      />
      <div className="about-hero">
        <img src="/assets/centros/Virelia EPS.png" alt="Sede de Virelia" />
        <div>
          <Icon name="leaf" size={40} />
          <h2>
            Más claridad en tus trámites.
            <br />
            Más espacio para tu bienestar.
          </h2>
          <p>
            Virelia Health organiza tus servicios de salud en un portal
            accesible y seguro. Nuestro propósito es acercar la información y
            simplificar las gestiones de las personas afiliadas.
          </p>
        </div>
      </div>
      <div className="filter-chips about-tabs">
        {[
          ["historia", "Nuestra historia"],
          ["esencia", "Misión y visión"],
          ["objetivos", "Objetivos"],
          ["modernizacion", "Modernización"],
          ["valores", "Nuestros valores"],
          ["equipo", "Cómo nos organizamos"],
        ].map(([k, label]) => (
          <button
            className={tab === k ? "selected" : ""}
            key={k}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "historia" && (
        <section className="card">
          <p className="eyebrow">HISTORIA DE LA PROPUESTA</p>
          <h2>De informar a acompañar.</h2>
          <div className="team-areas">
            {[
              [
                "El punto de partida",
                "Un sitio de información con apartados institucionales y de afiliados.",
              ],
              [
                "La migración",
                "Una navegación clara para tus trámites y servicios.",
              ],
              [
                "Los servicios",
                "Citas, correos, avisos y solicitudes conectados a datos persistentes.",
              ],
              [
                "Tu espacio",
                "Cada cuenta puede gestionar su información en un lugar propio.",
              ],
            ].map(([t, d]) => (
              <div key={t}>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <p>Gestiona tu información, citas y solicitudes desde tu cuenta.</p>
        </section>
      )}
      {tab === "objetivos" && (
        <section className="card">
          <h2>Lo que guía esta experiencia</h2>
          <div className="team-areas">
            {[
              [
                "01",
                "Simplificar trámites",
                "Dar un recorrido claro para cada necesidad.",
              ],
              [
                "02",
                "Orientar mejor",
                "Presentar información de acuerdo con el tema consultado.",
              ],
              [
                "03",
                "Cuidar el acceso",
                "Mostrar información personal únicamente a su titular.",
              ],
              [
                "04",
                "Dar seguimiento",
                "Conservar referencias y confirmaciones de las solicitudes.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === "modernizacion" && (
        <section className="card">
          <p className="eyebrow">MODERNIZACIÓN DIGITAL</p>
          <h2>Cambios que se sienten en cada trámite.</h2>
          <div className="team-areas">
            {[
              ["Agenda", "Disponibilidad y confirmación de horarios."],
              ["Documentos", "PDF descargable y solicitudes diferenciadas."],
              [
                "Comunicación",
                "Correos automáticos y seguimiento con radicado.",
              ],
              ["Experiencia", "Diseño adaptable y navegación por necesidades."],
            ].map(([t, d]) => (
              <div key={t}>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <p>
            El alcance es la modernización de la experiencia digital. El
            proyecto no presenta un plan financiero institucional ni cifras
            corporativas verificadas.
          </p>
        </section>
      )}
      {tab === "esencia" && (
        <div className="two-col">
          <div className="card">
            <p className="eyebrow">NUESTRA MISIÓN</p>
            <h2>Hacer más cercana tu experiencia.</h2>
            <p>
              Facilitar el acceso a la información y a los trámites digitales
              mediante una atención clara, respetuosa y centrada en las
              necesidades de las personas.
            </p>
          </div>
          <div className="card">
            <p className="eyebrow">NUESTRA VISIÓN</p>
            <h2>Una experiencia que evoluciona contigo.</h2>
            <p>
              Desarrollar un portal de salud comprensible y accesible, donde
              cada persona pueda gestionar sus solicitudes y conocer su
              seguimiento.
            </p>
          </div>
        </div>
      )}
      {tab === "valores" && (
        <div className="values-grid">
          {[
            ["Cercanía", "Escuchamos las necesidades de cada persona."],
            ["Respeto", "Cuidamos la forma de comunicarnos."],
            ["Claridad", "La información debe ser fácil de entender."],
            [
              "Confianza",
              "La información personal permanece en la cuenta de su titular.",
            ],
          ].map(([title, text]) => (
            <article className="card" key={title}>
              <Icon name="heart" />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      )}
      {tab === "equipo" && (
        <section className="card">
          <h2>Un equipo, varias formas de acompañarte.</h2>
          <div className="team-areas">
            {[
              "Atención a las personas",
              "Gestión de afiliación",
              "Apoyo asistencial",
              "Canales digitales",
              "Calidad y mejora",
            ].map((v, i) => (
              <div key={v}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <h3>{v}</h3>
              </div>
            ))}
          </div>
          <p>
            La propuesta reúne funciones de atención, gestión y tecnología. Esta
            representación corresponde al proyecto institucional.
          </p>
        </section>
      )}
    </section>
  );
}
