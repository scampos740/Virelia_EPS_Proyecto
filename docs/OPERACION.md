# Respaldo restauración actualización y reversión

## Respaldo local cifrado

`scripts/backup.mjs` utiliza una transacción de lectura consistente para las cinco bases lógicas (cuatro servicios y la base histórica de PQRS). Incluye sesiones, tokens con hash, auditoría, registros clínicos, adendas y colas; el archivo debe tratarse como información sensible. No incluye `.env`, certificados TLS, usuarios MySQL, grants ni binlogs. El respaldo lógico carga los datos en memoria y está orientado al volumen pequeño del proyecto; para gran volumen utiliza una herramienta de respaldo especializada y prueba su capacidad.

Define `BACKUP_PASSPHRASE` de al menos 20 caracteres mediante un gestor de secretos o entrada privada. No la escribas en repositorios, capturas ni comandos compartidos. Ejecuta:

```powershell
npm run db:backup -- C:\RespaldosPrivados\virelia.enc
```

El directorio debe existir. La contraseña no se imprime. El archivo usa AES-256-GCM, sal aleatoria, derivación scrypt e IV aleatorio; una contraseña incorrecta o alteración impide descifrar. Copia el archivo cifrado a un destino separado y conserva la clave por un canal diferente. El archivo no es inmutable por sí mismo: restringe borrado y configura almacenamiento WORM si la política lo exige.

## Restauración segura

Prueba primero en un servidor aislado. Define BACKUP_PASSPHRASE y RESTORE_PREFIX con un prefijo nuevo que no exista. Conserva DB_PREFIX apuntando al origen; el script rechaza restaurar sobre él o sobre bases de destino existentes.

```powershell
$env:RESTORE_PREFIX = "virelia_restauracion_20261119"
npm run db:restore -- C:\RespaldosPrivados\virelia.enc
```

Requiere usuario operador con creación de bases/tablas/triggers e inserción. El script crea el esquema, aplica migraciones e importa filas. Si falla puede dejar bases de destino parciales; no las uses. Identifica la causa y restaura en otro prefijo. No modifica las bases activas. Verifica los conteos, las claves foráneas, los documentos, las atenciones y los mensajes. La prueba incluida verificó recuperación de una PQRS y rechazo del prefijo activo y de contraseña incorrecta; no constituye un ensayo de recuperación ante desastre de toda una EPS.

## Programación y retención

Define responsable y prueba diaria del resultado. El código incluye la operación de respaldo, no crea tareas de Windows ni una cuenta de almacenamiento sin autorización. Programa la ejecución con Programador de tareas usando cuenta de permisos limitados y variables privadas; revisa el código de salida. Guarda al menos una copia aislada del equipo. Haz un ensayo mensual de restauración y conserva evidencia con conteos, fecha y responsable, sin contenido clínico.

El respaldo de recuperación no sustituye los plazos de conservación de la historia clínica. Faltan una política de retención aprobada, copias externas de largo plazo e inmutabilidad verificada según el responsable. Documenta RPO y RTO después de un ensayo; no se prometen tiempos que no se midieron.

## Actualización local

Detén el supervisor, respalda configuración y datos, conserva código anterior, instala con `npm ci`, ejecuta `npm run db:init` con operador, comprueba y arranca una sola vez. La preparación de despliegue externo se retiró de esta entrega. Nunca ejecutes `npm audit fix --force` sin revisar cambios y pruebas.

## Reversión

Ante un error de código vuelve a la imagen o carpeta anterior compatible, sin eliminar tablas nuevas ni reescribir registros clínicos finalizados. Ante un error de datos, suspende escrituras, restaura en otro destino, reconcilia las operaciones posteriores al respaldo y aprueba el cambio de conexión. Conserva original, copia, fecha y responsable. El cambio de contraseña invalida sesiones en operación normal; tras restaurar, revisa y revoca las sesiones que no deban volver a estar vigentes.

## Registro y respuesta a incidentes

Los eventos de auditoría contienen actor, acción, recurso y fecha; no texto clínico, contraseña ni token. El acceso a auditoría debe ser restringido. El usuario runtime no puede modificar o borrar su auditoría. Un administrador MySQL sigue siendo capaz de alterar infraestructura: separar funciones, habilitar auditoría externa y conservar evidencia fuera del servidor son tareas institucionales pendientes.

Si se sospecha exposición: limita accesos, preserva evidencia, rota los secretos afectados, invalida sesiones, revisa grants y avisa al responsable de datos. Este ZIP contiene tu `.env` por solicitud expresa; consérvalo de forma privada y no lo reenvíes públicamente. Las claves incluidas en entregas anteriores deben evaluarse para rotación antes de un repositorio público.
