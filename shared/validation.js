export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function text(v, label, min = 1, max = 200) {
  if (
    typeof v !== "string" ||
    v.trim().length < min ||
    v.trim().length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)
  )
    throw new HttpError(
      400,
      `${label}: escribe entre ${min} y ${max} caracteres válidos.`,
    );
  return v.trim().normalize("NFC");
}
export function personName(v, label = "Nombre", max = 100) {
  v = text(v, label, 2, max).replace(/\s+/g, " ");
  if (!/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(v))
    throw new HttpError(
      400,
      `${label}: usa letras, espacios, apóstrofes o guiones entre palabras.`,
    );
  return v;
}
export function email(v) {
  v = text(v, "Correo", 5, 200).toLowerCase();
  if (
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
      v,
    ) ||
    v.split("@")[0].startsWith(".") ||
    v.includes("..") ||
    v.split("@")[0].endsWith(".")
  )
    throw new HttpError(400, "Escribe un correo válido.");
  return v;
}
export function todayBogota(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function date(v) {
  v = text(v, "Fecha", 10, 10);
  const d = new Date(`${v}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== v ||
    v < "1900-01-01" ||
    v > todayBogota()
  )
    throw new HttpError(400, "La fecha de nacimiento no es válida.");
  return v;
}
export function ageAt(birth, today = todayBogota()) {
  let age = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  if (today.slice(5) < birth.slice(5)) age--;
  return age;
}
export const documentRules = {
  CC: { min: 3, max: 10, hint: "CC: de 3 a 10 dígitos; desde los 18 años." },
  TI: { min: 10, max: 10, hint: "TI: NUIP de 10 dígitos; de 7 a 17 años." },
  CE: { min: 1, max: 7, hint: "CE: de 1 a 7 dígitos." },
  PPT: { min: 1, max: 8, hint: "PPT: de 1 a 8 dígitos." },
  RC: {
    min: 10,
    max: 11,
    hint: "RC: NUIP de 10 o NIP de 11 dígitos; menores de 7 años.",
  },
};
export function identity(type, value, birth, allowRC = false) {
  choice(
    type,
    allowRC ? Object.keys(documentRules) : ["CC", "TI", "CE", "PPT"],
    "Tipo de documento",
  );
  const rule = documentRules[type],
    number = text(value, "Documento", rule.min, rule.max),
    age = ageAt(date(birth));
  if (!/^\d+$/.test(number) || /^0+$/.test(number))
    throw new HttpError(
      400,
      "Documento: usa únicamente dígitos, sin puntos ni espacios.",
    );
  if (
    (type === "CC" && age < 18) ||
    (type === "TI" && (age < 7 || age >= 18)) ||
    (type === "RC" && age >= 7)
  )
    throw new HttpError(
      400,
      `La edad no corresponde al documento. ${rule.hint}`,
    );
  return number;
}
export function password(v) {
  if (
    typeof v !== "string" ||
    v.length < 8 ||
    v.length > 100 ||
    /\s/.test(v) ||
    !/[A-Z]/.test(v) ||
    !/[a-z]/.test(v) ||
    !/[0-9]/.test(v)
  )
    throw new HttpError(
      400,
      "Contraseña: de 8 a 100 caracteres, con mayúscula, minúscula y número, sin espacios.",
    );
  return v;
}
export function choice(v, options, label) {
  if (!options.includes(v)) throw new HttpError(400, `${label} no válido.`);
  return v;
}
export function requireRow(r) {
  if (!r) throw new HttpError(404, "No encontramos la información solicitada.");
  return r;
}
export function contact(b) {
  const telefono = text(b.telefono, "Teléfono", 10, 13).replace(/^\+57/, "");
  if (!/^(3\d{9}|60[1-8]\d{7})$/.test(telefono))
    throw new HttpError(
      400,
      "Teléfono: escribe un celular colombiano de 10 dígitos o un fijo con indicativo 60, sin espacios. +57 es opcional.",
    );
  const direccion = text(b.direccion, "Dirección", 5, 200);
  if (!/^[\p{L}\p{M}\d\s#.,º°/()'-]+$/u.test(direccion))
    throw new HttpError(
      400,
      "Dirección: usa letras, números y signos de nomenclatura (#, guion, punto, coma o /).",
    );
  return { telefono, direccion, ciudad: personName(b.ciudad, "Ciudad") };
}
export function registration(b) {
  if (
    Object.keys(b).some(
      (k) =>
        ![
          "nombres",
          "apellidos",
          "email",
          "password",
          "tipoDocumento",
          "documento",
          "nacimiento",
          "telefono",
          "direccion",
          "ciudad",
          "consentimiento",
        ].includes(k),
    )
  )
    throw new HttpError(400, "El registro contiene campos no permitidos.");
  if (b.consentimiento !== true)
    throw new HttpError(400, "Debes aceptar el uso de datos personales.");
  return {
    nombres: personName(b.nombres, "Nombres"),
    apellidos: personName(b.apellidos, "Apellidos"),
    correo: email(b.email),
    password: password(b.password),
    nacimiento: date(b.nacimiento),
    documento: identity(b.tipoDocumento, b.documento, b.nacimiento),
    tipo: b.tipoDocumento,
    ...contact(b),
  };
}
export function futureSlot(b) {
  const fecha = text(b.fecha, "Fecha", 10, 10),
    hora = text(b.hora, "Hora", 5, 5),
    d = new Date(`${fecha}T${hora}:00-05:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
    !/^([01]\d|2[0-3]):(00|30)$/.test(hora) ||
    !Number.isFinite(d.getTime()) ||
    todayBogota(d) !== fecha ||
    d <= new Date() ||
    d > new Date(Date.now() + 366 * 86400000)
  )
    throw new HttpError(
      400,
      "Elige una fecha futura hasta un año y una hora en intervalos de 30 minutos (Colombia).",
    );
  return {
    fecha,
    hora,
    especialidad: personName(b.especialidad, "Especialidad", 80),
    sede: text(b.sede, "Sede", 3, 100),
  };
}
