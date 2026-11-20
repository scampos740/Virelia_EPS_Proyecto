# Seguridad por capas implementada

El detalle de cada requisito, estado y evidencia se encuentra en MATRIZ_SEGURIDAD.md. No existe una declaración de cumplimiento total.

1. Identidad: hash scrypt con sal, sesión opaca en cookie HttpOnly, verificación de correo, desafío de dos pasos ligado al navegador, recuperación por token con hash y límites MySQL. El correo es un segundo paso de seguridad limitado; no se presenta como autenticación resistente al phishing.
2. Acceso: titularidad comprobada por sesión y SQL, rol paciente fijo en registro, doctor autorizado mediante operador, atención ligada a la cita asignada. Cambiar un ID no otorga acceso. Afiliación y cuenta no se confunden para impedir consultar documentos históricos inactivos.
3. Integridad: consultas parametrizadas, índices de horario y transacciones, borradores con versión, registros finalizados protegidos por backend y triggers, adendas append-only. Auditoría mínima por actor y recurso, sin contenidos clínicos.
4. Red y configuración: solo gateway público en producción, servicios loopback, CORS al origen configurado, respuestas sin información interna, políticas de seguridad del navegador, configuración de TLS MySQL disponible con verificación de certificado. Credenciales operadoras no se entregan al runtime.
5. Datos: PDF generado en memoria, sin directorio público; verificador de certificados exige código y huella. Backup cifrado AES-256-GCM y restauración aislada. Retención institucional y copias inmutables externas pendientes.
6. Operación: supervisor recupera un proceso, frontend maneja caídas por sección, outbox conserva envíos, CI y Dependabot proponen parches. El monitoreo institucional externo sigue pendiente. Políticas humanas y administrativas requieren aprobación y capacitación.

`.env.example` no incluye valores secretos. El ZIP local incluye tu `.env` original por solicitud expresa; mantén el paquete privado y no lo subas a un repositorio. La cuenta runtime no necesita root ni permisos DDL. El proyecto se ejecuta localmente y no requiere servicios de pago.
