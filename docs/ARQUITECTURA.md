# Arquitectura y responsabilidades

| Proceso              | Puerto local | Base                           | Responsabilidad                                                                            |
| -------------------- | -----------: | ------------------------------ | ------------------------------------------------------------------------------------------ |
| Gateway              |         3000 | Ninguna                        | Proxy de API, bloqueo de rutas internas, frontend compilado en producción                  |
| Afiliados            |         3001 | afiliados y atencion histórica | Identidad, perfil, familia, verificación, dos pasos, recuperación y PQRS                   |
| Citas                |         3002 | citas                          | Disponibilidad, reservas, registros clínicos y adendas                                     |
| Documentos           |         3003 | documentos                     | Consulta y generación de historia y certificado, trazabilidad y verificación criptográfica |
| Notificaciones       |         3004 | notificaciones                 | Cola de correos y reintentos SMTP                                                          |
| Vite solo desarrollo |         5173 | Ninguna                        | Servidor de desarrollo React                                                               |

Las bases llevan el prefijo `DB_PREFIX`. La base `atencion` permanece para conservar las PQRS, mensajes y eventos. Su controlador y outbox ahora se ejecutan dentro de Afiliados. No existe servicio ni proceso Atención ni escucha en 3005. Las llamadas del frontend pasan a `/api/afiliados/pqrs`.

Documentos no almacena PDF públicos ni crea enlaces permanentes a historias. Genera el archivo en memoria a partir de MySQL y lo devuelve tras verificar sesión y titularidad. La base Documentos conserva huellas de certificados y auditoría, no los PDF. El contenido clínico pertenece a Citas. El documento de seguridad se interpretó también mediante su diagrama de seis capas.

Esta entrega se ejecuta localmente. React usa Vite en el puerto 5173 y el gateway está en el 3000, salvo que tu configuración indique otro puerto. Se conserva Docker Compose para MySQL, con su volumen persistente. No se requieren cuentas, plantillas ni servicios de una plataforma de nube.

Los cuatro servicios tienen procesos separados y un supervisor los reinicia de forma individual. La caída de un proceso no detiene el contenido público; la caída de Afiliados afecta las funciones que requieren comprobar sesión. Esto no constituye alta disponibilidad de infraestructura. La cola SMTP mantiene el comportamiento de entrega al menos una vez; un corte entre aceptación SMTP y actualización de MySQL puede duplicar un correo. No ejecutes dos supervisores para la misma instalación.

No había rol ni panel administrador operativo en la versión adjunta. Se conserva el aprovisionamiento de doctores por operador; no se inventa un administrador público ni contraseña inicial.
