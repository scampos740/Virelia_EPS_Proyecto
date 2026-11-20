import { startServer, currentUser, internal } from "../../../shared/http.js";
import { db, rows, transaction } from "../../../shared/db.js";
import { sessionToken, tokenHash } from "../../../shared/security.js";
import { HttpError, text } from "../../../shared/validation.js";
import { pdf, section, colombiaDate } from "../../../shared/pdf.js";
import { audit } from "../../../shared/audit.js";
import { limit } from "../../../shared/limit.js";
import { appUrl } from "../../../shared/mail.js";
const pool = db("documentos");
startServer("documentos", async (req, url, b) => {
  const p = url.pathname,
    m = req.method;
  if (p === "/verificar" && m === "POST") {
    await limit(pool, `certificate:${req.socket.remoteAddress}`, 30);
    const code = text(b.code, "Código", 64, 64),
      hash = text(b.pdfHash, "Huella SHA-256 del PDF", 64, 64);
    if (!/^[a-f0-9]{64}$/.test(code) || !/^[a-f0-9]{64}$/.test(hash))
      throw new HttpError(400, "Código o huella inválidos.");
    const [c] = await rows(
      pool,
      "SELECT issued_at FROM certificates WHERE code_hash=? AND pdf_hash=?",
      [tokenHash(code), hash],
    );
    return {
      data: { valid: Boolean(c), ...(c ? { issuedAt: c.issued_at } : {}) },
    };
  }
  const u = await currentUser(req);
  if (u.role !== "paciente")
    throw new HttpError(
      403,
      "Los documentos personales están disponibles para su titular.",
    );
  if (p === "/" && m === "GET") {
    const [certificate] = await rows(
      pool,
      "SELECT MAX(issued_at) AS issued FROM certificates WHERE user_id=?",
      [u.id],
    );
    const [historyIssue] = await rows(
      pool,
      "SELECT MAX(created_at) AS issued FROM audit_events WHERE actor_id=? AND action='history.download'",
      [u.id],
    );
    return {
      data: [
        {
          type: "afiliacion",
          title: "Certificado de afiliación",
          available: Boolean(u.fechaAfiliacion),
          date: u.fechaAfiliacion || null,
          issuedAt: certificate.issued || null,
        },
        {
          type: "historia",
          title: "Historia clínica",
          date: null,
          issuedAt: historyIssue.issued || null,
        },
      ],
    };
  }
  if (p === "/historia" && m === "GET") {
    const records = await internal("citas", `/_internal/historia/${u.id}`);
    await audit(pool, u.id, "history.read", u.id);
    return {
      data: {
        patient: {
          nombres: u.nombres,
          apellidos: u.apellidos,
          tipoDocumento: u.tipoDocumento,
          documento: u.documento,
        },
        records,
      },
    };
  }
  if (p === "/historia/pdf" && m === "GET") {
    const records = await internal("citas", `/_internal/historia/${u.id}`);
    if (!records.length)
      throw new HttpError(
        404,
        "Aún no tienes atenciones finalizadas para generar tu historia clínica.",
      );
    const raw = await pdf("Historia clínica", (doc) => {
      section(
        doc,
        "Titular",
        `${u.nombres} ${u.apellidos} · ${u.tipoDocumento} ${u.documento}`,
      );
      section(doc, "Expedición", colombiaDate(new Date().toISOString()));
      for (const r of records) {
        section(
          doc,
          "Atención",
          `${colombiaDate(r.attended_at)} · Profesional: ${r.doctor_name} · Registro: ${r.id}`,
        );
        for (const [key, label] of [
          ["reason", "Motivo de consulta"],
          ["observations", "Observaciones clínicas"],
          ["diagnosis", "Diagnóstico"],
          ["plan", "Indicaciones y plan de manejo"],
        ])
          section(doc, label, r[key]);
        for (const a of r.addenda)
          section(
            doc,
            "Adenda",
            `${colombiaDate(a.created_at)} · ${a.doctor_name}\n${a.content}`,
          );
      }
    });
    await audit(pool, u.id, "history.download", u.id);
    return { raw, filename: "historia-clinica.pdf" };
  }
  if (p === "/afiliacion/pdf" && m === "GET") {
    if (
      !u.fechaAfiliacion ||
      !u.nombres ||
      !u.apellidos ||
      !u.documento ||
      !u.estado
    )
      throw new HttpError(
        409,
        "Faltan datos indispensables de afiliación. Solicita a la entidad validar y registrar tu fecha de afiliación.",
      );
    const code = sessionToken(),
      issued = new Date().toISOString();
    const raw = await pdf("Certificado de afiliación", (doc) => {
      section(doc, "Afiliado", `${u.nombres} ${u.apellidos}`);
      section(doc, "Identificación", `${u.tipoDocumento} ${u.documento}`);
      if (u.numeroAfiliacion)
        section(doc, "Número de afiliación", u.numeroAfiliacion);
      section(doc, "Fecha de afiliación", u.fechaAfiliacion);
      section(doc, "Estado registrado", u.estado);
      section(doc, "Fecha de expedición", colombiaDate(issued));
      section(doc, "Código único de verificación", code);
      section(
        doc,
        "Comprobar autenticidad",
        `${appUrl()}/#/verificar-certificado\nCarga este PDF en el verificador e ingresa el código. Se contrasta la huella digital del archivo sin publicar datos del afiliado. El estado corresponde a la fecha de expedición.`,
      );
    });
    await transaction(pool, async (c) => {
      await rows(
        c,
        "INSERT INTO certificates(code_hash,user_id,pdf_hash,issued_at) VALUES(?,?,?,UTC_TIMESTAMP())",
        [tokenHash(code), u.id, tokenHash(raw)],
      );
      await audit(c, u.id, "certificate.issue", u.id);
    });
    return { raw, filename: "certificado-afiliacion.pdf" };
  }
});
