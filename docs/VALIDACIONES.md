# Formularios y reglas de negocio

Las reglas viven en `shared/validation.js`, importado tanto por React como por las APIs. El navegador limita longitud y tipo de entrada y muestra indicaciones; la API valida todo nuevamente aunque se envíe una petición por fuera del formulario. No se aceptan campos de rol en registro público.

## Documento y edad

| Tipo admitido            | Formato del prototipo          | Edad                                                  |
| ------------------------ | ------------------------------ | ----------------------------------------------------- |
| CC                       | Numérico, 3–10 dígitos         | Desde 18 años                                         |
| TI                       | NUIP numérico de 10 dígitos    | 7 años hasta antes de cumplir 18                      |
| CE                       | Numérico, 1–7 dígitos          | Sin una restricción de edad adicional en el prototipo |
| PPT                      | Numérico, 1–8 dígitos          | Sin una restricción de edad adicional en el prototipo |
| RC (solo grupo familiar) | NUIP de 10 o NIP de 11 dígitos | Menores de 7 años                                     |

No se admiten puntos, letras, espacios ni un número compuesto solo por ceros. La edad se calcula comparando el cumpleaños completo con la fecha de Colombia; no basta restar años. Se rechazan fechas futuras o imposibles. El registro de pacientes soporta CC, TI, CE y PPT. RC se agrega desde el grupo familiar. Esto no consulta Registraduría, Migración Colombia ni ADRES y no verifica que un documento exista o esté vigente.

Son reglas de un perfil académico acotado, no un validador normativo universal de todos los documentos históricos y sistemas de salud. No se rechazan CC antiguas por exigirles diez dígitos. La TI se acota al NUIP moderno; la información oficial también contempla formatos históricos que necesitarían evaluación adicional al migrar datos reales. Las especificaciones de longitudes de RIPS, SAT y otros reportes no son necesariamente iguales. No se implementa un supuesto dígito de verificación común a todos los documentos.

Fuentes oficiales consultadas: [Registraduría: TI desde los 7 y hasta los 18](https://registraduria.gov.co/Tarjeta-de-identidad-Primera-vez-7595.html), [Circular 1 de 2023, NUIP de 10 dígitos](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/circular_registraduria_0001_2023.htm), [Minsalud: estructura SAT-ARL, CC 3–10 y CE 1–7](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/OT/definicion-estructura-servicio-web-salida-sat-arl.pdf) y [Resolución 572 de 2022, especificación PPT hasta 8](https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=122499).

## Caracteres y formato

- Nombres/apellidos: letras Unicode y tildes; espacios, guiones y apóstrofes entre palabras. No números ni etiquetas HTML. De 2 a 100 caracteres; nombre del familiar hasta 150.
- Correo: hasta 200 caracteres, sin espacios, con usuario y dominio; se normaliza a minúsculas. La verificación por enlace comprueba acceso al correo, no identidad.
- Contraseña nueva: 8–100 caracteres, mayúscula, minúscula y número, sin espacios. El login permite contraseñas anteriores para no bloquear cuentas ya creadas. Se almacena una derivación scrypt con sal.
- Teléfono: celular colombiano de diez dígitos que inicia en 3, o fijo de diez dígitos con indicativo 601–608. Prefijo +57 opcional; no espacios ni guiones. Es una validación de formato local, no comprueba que la línea exista.
- Dirección: 5–200 caracteres; letras, números y signos de nomenclatura. Ciudad: letras y separadores de nombres, hasta 100 caracteres.
- PQRS y mensajes: límites de longitud, tipos permitidos y caracteres de control rechazados. La interfaz renderiza texto; nunca lo interpreta como HTML.

## Reglas de negocio

- La fecha de nacimiento corresponde al tipo de documento. El titular no puede agregarse como su propio familiar. Hijo/a debe nacer después del titular y este debe tener al menos 12 años (regla de demostración, no validación legal de parentesco).
- La combinación tipo/número de documento y el correo no pueden duplicarse en cuentas. Un integrante no se repite dentro del mismo grupo familiar. El usuario solo modifica sus registros.
- Una sola cita activa por paciente/fecha/hora, con bloqueo de una fila por paciente en transacción MySQL. Otra persona no puede tomar el mismo horario del doctor. La reprogramación verifica el nuevo horario antes de liberar el anterior; si falla, rollback conserva la cita original.
- El doctor debe tener rol autorizado en la sesión; solo publica y retira sus propios horarios. No retira uno reservado. No asigna una cita a un paciente sin su reserva.
- Horarios en Colombia, futuros, hasta un año y en intervalos de 30 minutos. El modelo compara horas de inicio, no maneja duraciones variables.

Las restricciones no reemplazan la revisión de privacidad ni un flujo institucional de identificación para una EPS real. Las cuentas de menores se usan únicamente con datos ficticios en este prototipo; no se implementó consentimiento verificable de representante legal.
