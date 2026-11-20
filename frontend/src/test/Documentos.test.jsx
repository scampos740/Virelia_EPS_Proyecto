import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Documentos from "../pages/Documentos.jsx";
import Recuperar from "../pages/Recuperar.jsx";
import AtencionClinica from "../pages/AtencionClinica.jsx";
import { api } from "../services/api.js";
vi.mock("../services/api.js", () => ({ api: vi.fn(), send: JSON.stringify }));
beforeEach(() => vi.resetAllMocks());
it("Documentos distingue certificado e historia y muestra ausencia de atenciones", async () => {
  api.mockResolvedValueOnce([
    {
      type: "afiliacion",
      title: "Certificado de afiliación",
      available: false,
    },
    { type: "historia", title: "Historia clínica" },
  ]);
  render(<Documentos />);
  await screen.findByText("Certificado de afiliación");
  expect(screen.getByText(/fecha de afiliación requiere/)).toBeInTheDocument();
  api.mockResolvedValueOnce({
    patient: { nombres: "Ana", apellidos: "Torres" },
    records: [],
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Consultar historia clínica" }),
  );
  await screen.findByText("Aún no tienes atenciones finalizadas");
});
it("Documentos permite reintentar si el servicio falla", async () => {
  api.mockRejectedValueOnce(new Error("Servicio temporalmente fuera de línea"));
  render(<Documentos />);
  await screen.findByText("Servicio temporalmente fuera de línea");
  expect(
    screen.getByRole("button", { name: /Reintentar/ }),
  ).toBeInTheDocument();
});
it("recuperación envía el correo y muestra la respuesta genérica", async () => {
  api.mockResolvedValueOnce({
    message: "Si existe la cuenta recibirás un enlace.",
  });
  render(<Recuperar onNavigate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Correo registrado"), {
    target: { value: "ana@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar instrucciones" }));
  await screen.findByText("Si existe la cuenta recibirás un enlace.");
  expect(api).toHaveBeenCalledWith("afiliados", "/recuperacion/solicitar", {
    method: "POST",
    body: JSON.stringify({ email: "ana@example.test" }),
  });
});
it("el registro finalizado solo permite adendas y conserva el texto original", async () => {
  api.mockResolvedValueOnce({
    appointment: {
      paciente_nombre: "Ana Torres",
      fecha: "2026-01-01",
      hora: "10:00",
    },
    record: {
      status: "Finalizada",
      reason: "Motivo original",
      observations: "Observación",
      diagnosis: "Diagnóstico",
      plan: "Plan",
    },
    addenda: [],
  });
  render(<AtencionClinica appointmentId="a" onBack={vi.fn()} />);
  await screen.findByDisplayValue("Motivo original");
  expect(screen.getByLabelText("Motivo de consulta")).toHaveAttribute(
    "readonly",
  );
  expect(
    screen.queryByRole("button", { name: "Guardar borrador" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Registrar adenda" }),
  ).toBeInTheDocument();
});
it("finalizar un borrador pide confirmación sin enviar accidentalmente el formulario", async () => {
  api.mockResolvedValue({
    appointment: {
      paciente_nombre: "Ana Torres",
      fecha: "2026-01-01",
      hora: "10:00",
    },
    record: {
      version: 1,
      status: "Borrador",
      reason: "Motivo",
      observations: "Observación",
      diagnosis: "Diagnóstico",
      plan: "Plan",
    },
    addenda: [],
  });
  render(<AtencionClinica appointmentId="a" onBack={vi.fn()} />);
  await screen.findByDisplayValue("Motivo");
  fireEvent.click(screen.getByRole("button", { name: "Finalizar atención" }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(api).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Confirmar finalización" }),
  ).toHaveAttribute("type", "button");
  fireEvent.click(screen.getByRole("button", { name: "Volver al borrador" }));
  expect(api).toHaveBeenCalledTimes(1);
});
