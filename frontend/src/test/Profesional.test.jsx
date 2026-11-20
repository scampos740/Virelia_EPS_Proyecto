import Citas from "../pages/Citas.jsx";
import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Doctor from "../pages/Doctor.jsx";
import Acceso from "../pages/Acceso.jsx";
import { api } from "../services/api.js";
vi.mock("../services/api.js", () => ({ api: vi.fn(), send: JSON.stringify }));
beforeEach(() => vi.resetAllMocks());
it("acceso profesional separado, sin registro público de doctor", () => {
  render(<Acceso professional onLogin={vi.fn()} onNavigate={vi.fn()} />);
  expect(
    screen.getByRole("heading", { name: "Ingresa como doctor" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Crear cuenta" }),
  ).not.toBeInTheDocument();
});
it("un fallo de citas muestra reintento dentro de la agenda profesional", async () => {
  api.mockRejectedValueOnce(new Error("Citas no disponible"));
  render(
    <Doctor
      user={{
        nombres: "Laura",
        apellidos: "Prueba",
        email: "laura@example.test",
      }}
    />,
  );
  await screen.findByText("Citas no disponible");
  expect(
    screen.getByRole("heading", { name: "Publicar un horario" }),
  ).toBeInTheDocument();
  api.mockResolvedValueOnce([]);
  fireEvent.click(
    screen.getByRole("button", { name: "Reintentar", exact: true }),
  );
  await screen.findByText("Aún no hay horarios");
});
it("registro inválido muestra la regla sin enviar datos a la API", async () => {
  render(<Acceso register onLogin={vi.fn()} onNavigate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "persona@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Prueba123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "datos personales",
  );
  expect(api).not.toHaveBeenCalled();
});

it("la especialidad del doctor es visible y no editable desde la página", async () => {
  api.mockResolvedValue([]);
  render(
    <Doctor
      user={{
        nombres: "Ana",
        apellidos: "Torres",
        email: "ana@example.test",
        especialidad: "Cardiología",
      }}
    />,
  );
  expect(screen.getByLabelText("Especialidad")).toHaveValue("Cardiología");
  expect(screen.getByLabelText("Especialidad")).toHaveAttribute("readonly");
  await screen.findByText("Aún no hay horarios");
});

it("el filtro de pacientes incluye especialidades reales de los horarios", async () => {
  api.mockImplementation((service, path) =>
    Promise.resolve(
      path === "/disponibilidad"
        ? [
            {
              id: "slot",
              especialidad: "Cardiología",
              fecha: "2027-01-01",
              hora: "10:00",
              profesional: "Ana Torres",
              sede: "Sede",
            },
          ]
        : [],
    ),
  );
  render(<Citas />);
  await screen.findByRole("option", { name: "Cardiología" });
});
