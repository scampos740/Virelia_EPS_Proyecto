# Pruebas y límites de verificación

Fecha: 19 de noviembre de 2026. Node.js 24.22.3, MySQL 8.4.7 real en TCP local, bases con prefijos de QA diferentes de la configuración del usuario. SMTP local de prueba que acepta y captura mensajes. No se conectó a la base del usuario ni se utilizó Gmail real. La preparación de nube fue retirada posteriormente; se conservaron las pruebas funcionales locales. Los datos clínicos de prueba se generaron exclusivamente en ese entorno aislado.

| Comprobación                                                    | Resultado                                                                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm test` API, validaciones, seguridad y caída real de proceso | 19 aprobadas                                                                                             |
| `npm test` React con Vitest y Testing Library                   | 26 aprobadas                                                                                             |
| `npm run test:integration` MySQL y SMTP                         | 35 aprobadas                                                                                             |
| `npm run test:production` sobre frontend compilado y gateway    | 1 aprobada                                                                                               |
| `npm run build`                                                 | Aprobado                                                                                                 |
| `npm run format:check`                                          | Aprobado                                                                                                 |
| `npm audit --omit=dev`                                          | 0 vulnerabilidades conocidas reportadas al ejecutar; no equivale a ausencia de fallos                    |
| `npm run test:e2e`, Chromium escritorio y Pixel 7               | 4 casos bloqueados al iniciar navegador por restricciones de IPC/socket; no se declara aprobación visual |
| Entrega efectiva en Gmail o correo corporativo                  | No verificada desde este entorno                                                                         |

Total: 81 casos automatizados aprobados en las suites ejecutables. Los cuatro casos de navegador fallaron por infraestructura antes de interactuar con la página y siguen pendientes. No se ocultan como aprobados ni se confunden pruebas React con navegación real.

## Cobertura funcional crítica

- Registro, validación de documento/edad, rechazo de rol inyectado y contraseña débil; verificación de correo válida, vencida y reutilizada.
- Login por contraseña y desafío; código del mismo navegador, vencimiento, reenvío, un solo uso y bloqueo persistente de intentos, tanto paciente como doctor.
- Recuperación: respuesta genérica para correo existente/desconocido, correo en SMTP de prueba, token con hash, vencimiento, uso único, confirmación distinta, nueva contraseña e invalidación de sesión anterior.
- Reservas concurrentes, aislamiento entre usuarios, reprogramación que conserva el estado si hay conflicto, cancelación y correos de las tres acciones. Doctores homónimos con agendas independientes. Horarios sin responsable no se ofrecen ni aceptan nuevas reservas.
- Atención clínica asignada: paciente rechazado, doctor ajeno rechazado, borrador editable, versión incompatible rechazada, borrador excluido de historia, finalización, inmutabilidad por API y UPDATE directo en MySQL, adenda y persistencia tras reiniciar.
- Historia del titular y ausencia de datos en otra cuenta, cambio de URL rechazado, archivo PDF válido. Certificado con fecha faltante rechazado, estado inactivo fiel, código y huella, verificación sin datos personales y huella alterada rechazada.
- PQRS integrado conserva radicado, mensajes e aislamiento; idempotencia de eventos y envío transaccional pese a preferencias opcionales.
- Respaldo cifrado, restauración a nuevo prefijo, rechazo del destino activo y contraseña incorrecta. Usuario MySQL de Citas puede consultar su base y no puede leer Afiliados, crear tablas ni borrar auditoría.
- El gateway sirve React y rutas internas directas, rechaza `.env` y endpoints internos, y mantiene el contenido público cuando la API responde 503. El supervisor reinicia Citas sin detener Afiliados ni Documentos.

## Inspección manual de documentos

Se generaron historia y certificado desde registros persistidos en las bases de prueba, se extrajo el texto con pdftotext y se renderizaron para inspección. Se comprobó identificación, fecha de afiliación, estado Inactivo, fecha de expedición, código único, profesional, campos clínicos y adenda. Se corrigió la fuente para asegurar tildes y legibilidad. No se incluyen PDF de pacientes ni ejemplos en el portal ni en este ZIP.

## Límites

No se realizaron pruebas con pacientes reales, evaluación jurídica, pentest acreditado, carga sostenida, alta disponibilidad, recuperación regional, alertas reales ni verificación de Gmail real ni despliegues externos. El contenido público y los módulos informativos se conservaron; necesitan revisión institucional de texto y canales. Los tests responsive existentes comprueban reglas/componentes, no una inspección en dispositivos reales. Antes de operar, ejecutar navegador, accesibilidad, correo, restauración y permisos en el entorno aprobado, sin agregar historias ficticias en producción.

CI reproduce MySQL y correo de prueba en un entorno desechable; los datos de fixture y credenciales de CI son exclusivos de pruebas. No son cuentas del portal publicado.

## Corrección de migración con MySQL estricto

Se reprodujo ER_BINLOG_CREATE_ROUTINE_NEED_SUPER con registro binario activo, configuración estricta y un usuario con permisos solo sobre las bases de la aplicación. test/migration-permissions.test.js comprobó creación de los cuatro triggers mediante el operador local, repetición idempotente, conservación de un dato existente, mismos grants antes y después y ninguna modificación de log_bin_trust_function_creators. El archivo .env se comprobó idéntico al adjunto original.

La especialidad se verificó mediante creación y actualización interactivas de consola con MySQL real, devolución del perfil, rechazo de sustitución por el navegador y conservación de horarios anteriores. Las pruebas React verifican especialidad de solo lectura y filtro de citas basado en especialidades disponibles.

Fecha de afiliación: comprobados registro, persistencia en MySQL, consulta posterior y generación del certificado para una cuenta nueva. Un perfil anterior sin fecha sigue requiriendo su validación. Se verificó el cambio de día en Colombia antes y después de las 05:00 UTC.
