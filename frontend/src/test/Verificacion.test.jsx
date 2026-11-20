import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Acceso from "../pages/Acceso.jsx";
import VerificarCorreo from "../pages/VerificarCorreo.jsx";
import { api } from "../services/api.js";
vi.mock("../services/api.js", () => ({ api: vi.fn(), send: JSON.stringify }));
beforeEach(() => {
  vi.resetAllMocks();
  window.location.hash = "/login";
});
it("una cuenta pendiente no abre sesión y permite solicitar otro enlace", async () => {
  api.mockRejectedValueOnce(
    Object.assign(new Error("Verifica tu correo."), {
      code: "EMAIL_NOT_VERIFIED",
    }),
  );
  const login = vi.fn();
  render(<Acceso onLogin={login} onNavigate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "persona@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Prueba123!" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Ingresar", exact: true }),
  );
  await screen.findByRole("heading", {
    name: "Verifica tu correo electrónico",
  });
  expect(login).not.toHaveBeenCalled();
  api.mockResolvedValueOnce({ message: "Solicitud recibida." });
  fireEvent.click(screen.getByRole("button", { name: "Reenviar enlace" }));
  await screen.findByText("Solicitud recibida.");
  expect(api).toHaveBeenLastCalledWith("afiliados", "/verificacion/reenviar", {
    method: "POST",
    body: JSON.stringify({ email: "persona@example.test" }),
  });
});
it("el registro que requiere verificación no inicia sesión automáticamente", async () => {
  api.mockResolvedValueOnce({
    verificationRequired: true,
    email: "nueva@example.test",
  });
  const login = vi.fn();
  render(<Acceso register onLogin={login} onNavigate={vi.fn()} />);
  for (const [label, value] of Object.entries({
    Nombres: "Ana",
    Apellidos: "Prueba",
    "Número de documento": "1234567890",
    "Fecha de nacimiento": "1995-05-12",
    Teléfono: "3001234567",
    Dirección: "Calle 10",
    Ciudad: "Bogotá",
  }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "nueva@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Prueba123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
  await screen.findByRole("heading", {
    name: "Verifica tu correo electrónico",
  });
  expect(login).not.toHaveBeenCalled();
});
it("confirmar el enlace muestra el resultado y retira el token de la dirección", async () => {
  const token = "a".repeat(64);
  window.location.hash = `/verificar?token=${token}`;
  api.mockResolvedValueOnce({ verified: true });
  render(<VerificarCorreo onNavigate={vi.fn()} />);
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar mi correo" }));
  await screen.findByRole("heading", { name: "Correo verificado" });
  expect(api).toHaveBeenCalledWith("afiliados", "/verificacion/confirmar", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  expect(window.location.hash).not.toContain(token);
});
it("un enlace vencido muestra el error y permite volver a solicitarlo", async () => {
  window.location.hash = `/verificar?token=${"b".repeat(64)}`;
  api.mockRejectedValueOnce(new Error("El enlace venció o ya fue utilizado."));
  render(<VerificarCorreo onNavigate={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar mi correo" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("El enlace venció"),
  );
  expect(
    screen.getByRole("link", { name: /solicitar otro enlace/ }),
  ).toBeInTheDocument();
});
