# Virelia Health

Versión local con React y Vite, Node.js y MySQL. Incluye afiliación, agenda profesional, atenciones clínicas, documentos PDF, correo transaccional y PQRS. Conserva los colores amarillo, azul y blanco.

## Actualizar tu instalación existente en Windows

1. Detén Virelia con Ctrl+C. Haz una copia privada de tu `.env` y un respaldo de MySQL. El ZIP contiene código y tu configuración privada, no una copia de tu servidor MySQL.
2. Extrae esta versión en otra carpeta. El ZIP ya incluye tu `.env` original, sin modificaciones. Si lo actualizaste posteriormente en tu computador, conserva esa copia más reciente. No publiques el ZIP ni subas el archivo al repositorio. Conserva el mismo `DB_PREFIX`, contraseña y volumen Docker. No ejecutes `docker compose down -v`.
3. Abre PowerShell en la nueva carpeta y ejecuta:

```powershell
npm ci
npm run db:init
npm run dev
```

Si actualizas una instalación existente, no necesitas volver a generar claves ni configurar Gmail. `db:init` añade tablas, columnas e índices y conserva usuarios, citas, PQRS y bases antiguas. Si tu usuario MySQL no tiene DDL, utiliza temporalmente `DB_ADMIN_USER` y `DB_ADMIN_PASSWORD` para la migración. Retíralos del entorno de ejecución al terminar.

4. Abre http://127.0.0.1:5173. Ejecuta `npm run dev` una sola vez. El puerto nuevo de Documentos es 3003; puedes cambiarlo con `DOCUMENTOS_PORT`. `ATENCION_PORT` ya no se utiliza, aunque permanezca en tu `.env` antiguo.
5. Comprueba Gmail con `npm run mail:check`. Verifica registro, enlace de cuenta, código de acceso y un correo de cita con cuentas controladas. La comprobación SMTP valida acceso, no entrega en bandeja.

## Instalación nueva

Instala Node.js 24, Docker Desktop con contenedores Linux y Git si vas a usar repositorio. Ejecuta `npm ci`, `npm run setup`, revisa `.env`, `docker compose up -d mysql`, `npm run db:prepare`, `npm run db:init`, `npm run mail:setup` y `npm run dev`. El puerto de MySQL debe coincidir con `DB_PORT`; utiliza 3307 si el 3306 está ocupado. No cambies la contraseña de un volumen ya inicializado esperando que Docker la restablezca.

Para MySQL instalado en Windows, omite Docker y configura sus credenciales existentes. Nunca uses la contraseña de otro computador suponiendo que es la tuya.

## Funciones y comandos

- `npm run doctor:create`: alta operadora de un profesional; solicita correo, nombres, apellidos, especialidad y contraseña.
- `npm run doctor:especialidad`: asigna la especialidad a un doctor existente mediante su correo. El registro público no permite elegir rol.
- `npm run affiliation:set`: registrar fecha y número de afiliación **previamente validados**. Las cuentas nuevas guardan automáticamente la fecha del registro en Colombia como fecha de afiliación. Este comando permite validar o corregir fechas de cuentas existentes.
- `npm run slots:assign`: vincular un horario histórico sin doctor a un profesional validado, usando ambos ID. Los horarios históricos no asignados se conservan, pero no se ofrecen para nuevas reservas.
- `npm run db:runtime-users`: preparar usuarios MySQL con permisos por servicio. Requiere credenciales operadoras y variables por dominio.
- `npm run build` y `npm start`: servir el frontend compilado y las API, sin Vite. No requiere ninguna plataforma de nube.
- `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run format:check`: comprobaciones separadas de producción.

## Documentación de entrega

- [Instalación y conservación de datos](docs/ACTUALIZACION.md)
- [Arquitectura y puertos](docs/ARQUITECTURA.md)
- [API y permisos](docs/API.md)
- [Respaldo restauración y reversión](docs/OPERACION.md)
- [Cambios implementados](docs/CAMBIOS.md)
- [Resultados y límites de verificación](docs/PRUEBAS.md)
- [Matriz del documento de seguridad](docs/MATRIZ_SEGURIDAD.md)
- [Operación con pacientes reales y pendientes](docs/OPERACION_REAL.md)

La versión se ejecuta en tu computador y conserva Docker Compose para MySQL. Se retiraron los archivos de despliegue en nube. La configuración privada se incluye por tu solicitud; mantén el ZIP privado. Los controles técnicos no equivalen a validación institucional para atender pacientes reales.
