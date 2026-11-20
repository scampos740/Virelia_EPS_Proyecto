import { db, rows } from "../../../../shared/db.js";
export const pool = db("afiliados");
export const publicProfile = (u) => ({
  id: u.id,
  role: u.role || "paciente",
  especialidad: u.role === "doctor" ? u.specialty || null : null,
  email: u.email,
  emailVerified: Boolean(u.email_verified),
  nombres: u.nombres,
  apellidos: u.apellidos,
  tipoDocumento: u.tipo_documento,
  documento: u.documento,
  nacimiento: u.nacimiento,
  telefono: u.telefono,
  direccion: u.direccion,
  ciudad: u.ciudad,
  estado: u.estado,
  regimen: u.regimen,
  fechaAfiliacion: u.affiliation_date,
  numeroAfiliacion: u.affiliation_number,
});
export async function profile(id, conn = pool) {
  return (await rows(conn, "SELECT * FROM users WHERE id=?", [id]))[0];
}
