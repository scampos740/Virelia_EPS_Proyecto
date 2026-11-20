# Actualización sin perder configuración ni datos

La configuración privada recibida se mantuvo sin cambios y, por solicitud expresa, se incluyó como `.env` en el entregable local. Conserva MySQL, correo, claves y puertos. El ZIP debe mantenerse privado; no debe subirse a un repositorio público. Si cambiaste tu configuración en el computador después de adjuntarla, conserva la copia más reciente. El código no se conectó a tu servidor ni utilizó tus credenciales SMTP reales para las pruebas.

Antes de migrar, haz respaldo cifrado y conserva la versión anterior del código. Prueba sobre una restauración con otro prefijo. Ejecuta `npm ci` y `npm run db:init`. Este comando es la migración oficial e idempotente: `shared/schema.js` crea tablas que falten y `shared/migrations.js` añade columnas e índices. No hay DROP DATABASE, truncado ni limpieza automática de cuentas.

Cambios aditivos: `users.affiliation_date` y `affiliation_number`, `password_resets`, `request_limits`, `audit_events`, `clinical_encounters`, `clinical_addenda`, `certificates`. Los registros finalizados y adendas tienen triggers de inmutabilidad. No se elimina la base antigua de Documentos si ya existe; tampoco se importan automáticamente sus archivos sin conocer su procedencia. Los certificados nuevos se generan desde el perfil real, no desde archivos antiguos.

PQRS conserva las tablas `cases`, `messages` y `outbox` en la base histórica `DB_PREFIX_atencion`. Afiliados ejecuta el controlador existente y su cola. `names` lista procesos y `domains` incluye también la base histórica; esta diferencia es intencional.

## Horarios anteriores

Los horarios con `doctor_id` vacío se conservan, pero no se permiten nuevas reservas sobre ellos. No se vinculan por nombre: dos doctores pueden llamarse igual y los nombres pueden tener espacios o tildes diferentes. Usa `npm run slots:assign` para cada horario identificado y respaldado por el operador. Si ya existe otro horario del mismo doctor, fecha y hora, MySQL rechaza la asignación sin cancelar reservas. Resuelve el conflicto de forma institucional; no se borran citas automáticamente.

Los usuarios anteriores no reciben una fecha de afiliación inventada. Valida el dato con el responsable y usa `npm run affiliation:set`. Si en el futuro habilitas el modo de producción, una afiliación sin validar no permite nuevas reservas. La afiliación inactiva puede ingresar con verificación y consultar documentos históricos; Citas conserva la restricción a afiliaciones activas.

## Datos de desarrollo

La versión anterior puede contener demo, horarios sembrados o registros introducidos manualmente. Se conservaron. No se realiza ninguna migración a otro entorno automáticamente. Si la base existente contiene datos reales, el responsable debe clasificar su origen y autorizar la migración de registros legítimos mediante respaldo cifrado y revisión. No elimines registros basándote solo en un nombre o dirección de correo.

## Error de privilegios al crear controles clínicos

Con el registro binario habilitado, MySQL puede devolver ER_BINLOG_CREATE_ROUTINE_NEED_SUPER cuando el usuario de aplicación intenta crear los triggers de integridad. La migración local corregida usa temporalmente la contraseña MYSQL_ROOT_PASSWORD ya existente para crear esos controles mediante root y cierra esa conexión al terminar. No cambia el archivo .env, no concede SUPER al usuario de aplicación, no desactiva el registro binario y no modifica opciones globales del servidor. Las migraciones explícitas con DB_ADMIN_USER conservan su configuración y producción requiere operador explícito. Vuelve a ejecutar npm run db:init; las tablas y datos creados antes del error se conservan.

## Especialidad del doctor

Ejecuta npm run db:init para añadir users.specialty sin borrar datos. npm run doctor:create solicita la especialidad por consola. Para doctores existentes usa npm run doctor:especialidad. No se inventan especialidades para perfiles antiguos. La página muestra el valor de solo lectura y el backend usa el valor guardado, ignorando cualquier especialidad enviada por el navegador. Los horarios y citas anteriores conservan su información; el cambio afecta a nuevos horarios. El doctor debe cerrar sesión y volver a ingresar para actualizar el valor en pantalla.

## Fecha automática para cuentas nuevas

Por la regla solicitada, desde esta versión el registro de un paciente guarda automáticamente como affiliation_date el día actual de Colombia (America/Bogota), calculado en el backend y persistido junto con la cuenta en la misma transacción. No se acepta una fecha manipulada en la petición pública. El perfil y el certificado usan ese dato. No se cambian fechas ni se rellenan valores vacíos de cuentas existentes; para esos casos se conserva npm run affiliation:set.
