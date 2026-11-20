# API y autorización

Todas las respuestas privadas llevan `Cache-Control: no-store`. JSON usa `data` o `error`. Los errores 500/503 no incluyen SQL, credenciales ni contenido clínico. Las rutas internas solo funcionan con clave interna y el gateway las bloquea. Cookies HttpOnly y SameSite=Lax; Secure obligatorio en producción. Las peticiones mutables requieren JSON y origen autorizado.

| Ruta                                                  | Método                              | Permiso                                                                           |
| ----------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| `/api/afiliados/registro`                             | POST                                | Público; rol fijo paciente                                                        |
| `/api/afiliados/login`                                | POST                                | Credenciales; devuelve desafío cuando dos pasos está activo                       |
| `/api/afiliados/login/confirmar`                      | POST                                | Código y cookie del mismo navegador                                               |
| `/api/afiliados/login/reenviar`                       | POST                                | Desafío vigente; enfriamiento y límites                                           |
| `/api/afiliados/verificacion/reenviar` y `/confirmar` | POST                                | Enlace de cuenta de un solo uso                                                   |
| `/api/afiliados/recuperacion/solicitar`               | POST                                | Respuesta genérica; límite persistente                                            |
| `/api/afiliados/recuperacion/confirmar`               | POST                                | token, password y confirmPassword                                                 |
| `/api/afiliados/me`, `/beneficiarios`                 | GET/PATCH/POST/DELETE según recurso | Titular; mismas funciones previas                                                 |
| `/api/afiliados/pqrs`                                 | GET/POST                            | Casos del titular                                                                 |
| `/api/afiliados/pqrs/:id`, `/:id/mensajes`            | GET/POST                            | Propiedad comprobada en SQL                                                       |
| `/api/citas/disponibilidad`, `/api/citas/`            | GET/POST                            | Paciente; horarios autorizados y validación de afiliación en producción           |
| `/api/citas/:id/cancelar`, `/:id/reagendar`           | PATCH                               | Titular, reserva vigente                                                          |
| `/api/citas/doctor/horarios` y `/:id`                 | GET/POST/DELETE                     | Doctor; agenda propia                                                             |
| `/api/citas/doctor/atenciones/:cita`                  | GET/PUT                             | Doctor asignado; cita agendada o atendida, sin acceso por nombre                  |
| `/api/citas/doctor/atenciones/:cita/finalizar`        | POST                                | Doctor asignado; todos los campos clínicos registrados                            |
| `/api/citas/doctor/atenciones/:cita/adendas`          | POST                                | Doctor responsable; registro finalizado                                           |
| `/api/documentos/`                                    | GET                                 | Tipos disponibles para el titular                                                 |
| `/api/documentos/historia`                            | GET                                 | Solo las atenciones finalizadas del paciente autenticado                          |
| `/api/documentos/historia/pdf`                        | GET                                 | Titular; PDF generado desde los mismos registros                                  |
| `/api/documentos/afiliacion/pdf`                      | GET                                 | Titular; fecha de afiliación indispensable                                        |
| `/api/documentos/verificar`                           | POST                                | Público con código aleatorio de 256 bits y SHA-256 del PDF; no devuelve identidad |

El listado Documentos no depende de Citas para mostrar el certificado: si Citas falla, la historia informa indisponibilidad y el certificado continúa cuando Afiliados y Documentos están disponibles. No hay identificador de otro paciente aceptado en una ruta pública de historia.

La página Notificaciones fue retirada. Su servicio conserva endpoints existentes para compatibilidad de preferencias e integración y para las pruebas; no hay enlaces al antiguo portal. Los correos de verificación, autenticación, citas y recuperación no se desactivan mediante preferencias opcionales.

`/health` de cada servicio mide vida del proceso; `/ready` prueba MySQL. Gateway `/health` mantiene el contenido público disponible aunque falle un servicio. En el código de cliente las fechas se presentan en America/Bogota; en BD las conexiones usan UTC. Las horas de agenda representan hora local de Colombia y aceptan intervalos de 30 minutos.
