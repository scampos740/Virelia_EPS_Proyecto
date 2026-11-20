import { db, rows, transaction, closePools } from "../shared/db.js";
import { ask as prompt, finish } from "./prompt.mjs";
import { date, text } from "../shared/validation.js";
import { audit } from "../shared/audit.js";
// Operador autorizado: fecha obtenida del registro institucional, nunca inferida.
const email = await prompt("Correo del afiliado: ");
const affiliationDate = date(
  await prompt("Fecha de afiliación validada (AAAA-MM-DD): "),
);
const number = await prompt("Número de afiliación (vacío si no existe): ");
try {
  await transaction(db("afiliados"), async (c) => {
    const [u] = await rows(
      c,
      "SELECT id FROM users WHERE email=? AND role='paciente' FOR UPDATE",
      [email.trim().toLowerCase()],
    );
    if (!u) throw Error("Afiliado no encontrado.");
    await rows(
      c,
      "UPDATE users SET affiliation_date=?,affiliation_number=? WHERE id=?",
      [affiliationDate, number ? text(number, "Número", 1, 50) : null, u.id],
    );
    await audit(c, "operador-local", "affiliation.validate", u.id);
  });
  console.log("Afiliación actualizada con los datos suministrados.");
} finally {
  await closePools();
  finish();
}
