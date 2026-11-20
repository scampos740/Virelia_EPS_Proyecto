import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Acceso from "../pages/Acceso.jsx";
import CodigoAcceso from "../pages/CodigoAcceso.jsx";
import { api } from "../services/api.js";
vi.mock("../services/api.js", () => ({ api: vi.fn(), send: JSON.stringify }));
beforeEach(() => vi.resetAllMocks());
it("la contraseña correcta solicita código sin iniciar sesión", async () => {
  api.mockResolvedValueOnce({
    loginCodeRequired: true,
    challengeId: "a".repeat(64),
    email: "ana@example.test",
  });
  const login = vi.fn();
  render(<Acceso onLogin={login} onNavigate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "ana@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Prueba123!" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Ingresar", exact: true }),
  );
  await screen.findByRole("heading", { name: "Código de acceso" });
  expect(login).not.toHaveBeenCalled();
  api.mockResolvedValueOnce({ id: "persona", role: "paciente" });
  fireEvent.change(screen.getByLabelText("Código de seis dígitos"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e ingresar" }));
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith({ id: "persona", role: "paciente" }),
  );
});
it("un código rechazado mantiene el formulario y no abre sesión", async () => {
  api.mockRejectedValueOnce(new Error("Código incorrecto."));
  const login = vi.fn();
  render(
    <CodigoAcceso
      challenge={{ email: "ana@example.test", challengeId: "a".repeat(64) }}
      onLogin={login}
      onBack={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Código de seis dígitos"), {
    target: { value: "654321" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e ingresar" }));
  await screen.findByText("Código incorrecto.");
  expect(login).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /Reenviar en/ })).toBeDisabled();
});
