import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Acceso from "../pages/Acceso.jsx";
it("formulario BOGOBIKER adaptado: valida el acceso vacío", () => {
  render(<Acceso onNavigate={vi.fn()} onLogin={vi.fn()} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Ingresar", exact: true }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "El correo y la contraseña son obligatorios.",
  );
});
it("el acceso muestra recuperación y no expone cuentas ni contraseñas predeterminadas", () => {
  render(<Acceso onNavigate={vi.fn()} onLogin={vi.fn()} />);
  expect(screen.getByText("¿Olvidaste tu contraseña?")).toBeInTheDocument();
  expect(screen.queryByText(/demo@/)).not.toBeInTheDocument();
});
