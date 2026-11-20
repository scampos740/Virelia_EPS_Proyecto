# Políticas del equipo para aprobación

Este documento debe ser aprobado por el responsable de la plataforma y acompañado de capacitación. Su existencia no acredita adopción.

Cada integrante utilizará una cuenta individual y tendrá solo los permisos necesarios. El alta de profesionales exige validar identidad, vínculo y alcance de atención. No compartir usuarios operadores ni contraseñas; usar un gestor de secretos y MFA robusto para infraestructura, repositorio y correo remitente. Las credenciales de desarrollo, producción, respaldo y MySQL administrador serán diferentes.

No subir `.env`, contraseñas, enlaces con tokens, bases clínicas ni capturas sensibles a repositorios, chats o tickets. Si se publican accidentalmente, notificar y rotar credenciales aunque se borre el archivo; el historial puede conservarlo. Los operadores verificarán dominio y destinatario antes de abrir enlaces, y reportarán correos sospechosos sin reenviar datos sensibles.

Bloquear la sesión al abandonar el equipo, aplicar cifrado de disco, actualizaciones de SO/navegador y firewall del host/router. Instalar software solo de fuentes verificadas. Dependabot propone cambios; un responsable revisará vulnerabilidades y ejecutará CI antes de aprobarlos. Registrar fecha, componente, pruebas, responsable y plan de reversión.

Respaldar según la política aprobada, verificar la ejecución y probar restauración periódicamente. Conservar clave y copia en ubicaciones separadas. Restringir la eliminación de copias y mantener una copia aislada o inmutable. Asignar responsable, RPO, RTO y retención clínica según el marco aplicable.

Frente a incidentes, preservar evidencia, contener accesos, notificar al responsable de seguridad y protección de datos y evaluar obligaciones de reporte con asesoría institucional. No borrar auditorías ni modificar registros clínicos finalizados para ocultar errores; usar adendas y procedimiento documentado.

Pendientes de aprobación: responsable legal y de seguridad, matriz de roles, aviso de privacidad, protocolo de incidentes, formación antiphishing, retención, autorizaciones para datos sensibles y menores, acceso profesional, uso de nube y restauración. Registrar evidencia de capacitación y revisar permisos al retirar integrantes.
