# Cambios implementados

1. Documentos recuperado como menú y servicio: historia en pantalla y PDF, certificado en PDF y verificador que contrasta código y huella sin revelar datos del titular. Logotipo original y fuente Unicode incluida con su licencia.
2. Atenciones del doctor con borradores, control de versión para evitar sobrescritura, finalización inmutable, adendas con autor y fecha, y auditoría sin contenidos clínicos.
3. Recuperación completa con SMTP a través de Notificaciones, token aleatorio con hash, 15 minutos, un solo uso, límites MySQL y cierre de sesiones y desafíos anteriores.
4. PQRS integrado en Afiliados, conservando base, registros y cola históricos. Eliminado el proceso Atención, su workspace y puerto activo.
5. Retirada la página de Notificaciones y los accesos a cuentas de ejemplo. Permanecen correos transaccionales y alertas contextuales.
6. Reservas y publicación basadas en doctor_id; no se confunden doctores homónimos. Horarios heredados sin responsable requieren vinculación explícita. Se conserva la serialización de reservas por paciente y profesional, junto con el índice único de doctor/fecha/hora.
7. Fecha de afiliación automática para pacientes nuevos según el día de registro en Colombia. Se conservan las fechas anteriores. Certificado bloqueado cuando falta el dato; CLI operadora para validarlo. El estado inactivo se conserva en el documento y no se oculta mediante valores predeterminados.
8. Usuarios MySQL por dominio en producción, auditoría append-only por permisos, triggers clínicos, CORS de origen exacto, TLS verificado y cookies seguras obligatorios, sin DDL en usuarios de ejecución.
9. Gateway puede servir React compilado con npm start. Se conserva Docker Compose para MySQL y CI de pruebas. Se retiraron las plantillas, guía y preparación de despliegue en nube.
10. Respaldo AES-256-GCM y restauración en un prefijo nuevo, preservando el activo. Dependabot propone actualizaciones semanales; no fusiona parches sin pruebas.
11. Se retiró el formulario decorativo de empleo que no enviaba postulaciones. Se conservaron los servicios informativos existentes, la navegación y los colores.

Se incluye la configuración privada original sin cambios, por solicitud expresa. No se ejecutaron migraciones en el MySQL del usuario. El ZIP adjunto no contiene un volcado de su MySQL; los datos continúan donde estaban guardados. No se inventaron firmas, NIT, habilitaciones, dominio, sellos ni matrículas profesionales.

Actualización de fecha: las nuevas cuentas de pacientes guardan automáticamente el día de registro en Colombia como afiliación. Las cuentas existentes no se modifican.
