import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
export const colombiaDate = (v) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  }).format(
    new Date(String(v).includes("T") ? v : String(v).replace(" ", "T") + "Z"),
  );
export async function pdf(title, render) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    bufferPages: true,
    info: { Title: title, Author: "Virelia Health" },
  });
  doc.registerFont(
    "Institutional",
    fileURLToPath(new URL("../assets/fonts/DejaVuSans.ttf", import.meta.url)),
  );
  doc.font("Institutional");
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.image(
    fileURLToPath(
      new URL("../frontend/public/assets/Logo-Virelia.png", import.meta.url),
    ),
    48,
    38,
    { fit: [140, 55] },
  );
  doc
    .fillColor("#164c82")
    .fontSize(22)
    .text("Virelia Health", 220, 52, { width: 325 });
  doc.y = 110;
  doc.x = 48;
  doc.fillColor("#182d45").fontSize(18).text(title);
  doc.moveDown();
  doc.fontSize(10);
  await render(doc);
  const { count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor("#344b64")
      .fontSize(8)
      .text(
        `Virelia Health · Documento reservado · Página ${i + 1} de ${count}`,
        48,
        790,
        { lineBreak: false },
      );
  }
  doc.end();
  return done;
}
export function section(doc, title, body) {
  if (doc.y > 690) doc.addPage();
  doc.fillColor("#164c82").fontSize(12).text(title);
  doc.moveDown(0.3);
  doc
    .fillColor("#182d45")
    .fontSize(10)
    .text(String(body || "Sin información registrada"), { width: 495 });
  doc.moveDown(0.8);
}
