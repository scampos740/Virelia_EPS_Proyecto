import { futureSlot, personName, HttpError } from "./validation.js";
export function doctorSlot(body, user) {
  if (!user.especialidad)
    throw new HttpError(
      409,
      "Solicita al operador registrar tu especialidad antes de publicar horarios.",
    );
  return futureSlot({
    ...body,
    especialidad: personName(user.especialidad, "Especialidad", 80),
  });
}
