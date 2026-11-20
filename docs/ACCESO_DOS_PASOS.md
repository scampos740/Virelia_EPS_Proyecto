# Acceso en dos pasos mediante correo

El flujo se aplica a pacientes y doctores cuando `EMAIL_LOGIN_OTP=true`:

1. El servidor comprueba correo, contraseña y estado de la cuenta.
2. Si el correo está verificado, solicita enviar un código de seis dígitos al email registrado. Todavía no crea una sesión autenticada.
3. La persona escribe el código en el mismo navegador donde comenzó el acceso. El código vence en cinco minutos y solo se puede usar una vez.
4. Solo después de validarlo se crea la cookie de sesión habitual.

La confirmación de correo al registrar una cuenta y el código al ingresar son controles distintos. Registrar confirma la dirección una vez; el segundo paso de acceso se realiza cada vez que se inicia una nueva sesión. Las sesiones ya abiertas conservan su vencimiento habitual de ocho horas; activar el ajuste no las revoca automáticamente. Cierra sesión para probar el nuevo flujo.

## Activación

Ejecuta `npm run db:init` para crear la tabla `login_challenges`. Después ejecuta `npm run mail:setup`: verifica la cuenta Gmail y activa tanto `REQUIRE_EMAIL_VERIFICATION=true` como `EMAIL_LOGIN_OTP=true`. Reinicia `npm run dev`. Si Gmail ya estaba configurado, también puedes añadir esas dos variables manualmente en `.env`.

No compartas la contraseña de aplicación en el chat, archivos entregados o Git. No existe una excepción de código para el doctor ni para la cuenta demo. La cuenta `demo@virelia.test` no puede recibir correo real; con este control activado debes usar una cuenta con un email que controles.

## Controles

- Aleatoriedad criptográfica; códigos de seis dígitos, incluyendo ceros iniciales.
- El desafío y la cookie temporal son valores aleatorios de 32 bytes. La cookie temporal es HttpOnly/SameSite y se guarda una huella en MySQL para vincular la confirmación al navegador que validó la contraseña.
- La tabla de desafíos conserva HMAC del código con la clave interna, no el código en claro. El texto del correo permanece temporalmente en las colas de entrega y se elimina tras entregarlo; no aparece en el historial visible.
- Cinco intentos incorrectos por desafío, almacenados en MySQL. El reenvío no los restablece. Las respuestas de error se generan después de confirmar el incremento para que un rollback no borre los intentos.
- Un reenvío cada 60 segundos, máximo tres envíos por desafío. Un nuevo acceso invalida desafíos anteriores del mismo usuario. Como máximo tres nuevos desafíos por usuario en 15 minutos.
- Validación, consumo del código y apertura de sesión dentro de la misma transacción: dos confirmaciones simultáneas no pueden reutilizarlo.
- Los mensajes de acceso no se pueden desactivar mediante las preferencias de otros avisos.

Si el correo tarda más que la vigencia, solicita uno nuevo o vuelve al acceso. Si falla SMTP, se conserva el pendiente para reintento y no se concede una sesión por omitir el código. Si falla Afiliados, las operaciones privadas se suspenden hasta recuperar la validación; la información pública continúa.

## Archivos

`services/afiliados/src/login-code.js`: creación, HMAC, límites, reenvío y confirmación. `frontend/src/pages/CodigoAcceso.jsx`: pantalla para escribir el código. `shared/schema.js`: almacenamiento. `services/notificaciones/src/server.js`: envío por SMTP y prioridad sobre las preferencias de avisos. `test/mail-verification.test.js`: pruebas con MySQL y receptor SMTP local.

## Alcance

Se denomina verificación de acceso en dos pasos por correo. No se presenta como MFA fuerte ni como cumplimiento de los niveles de garantía de NIST: el correo no prueba por sí solo posesión de un dispositivo y puede depender de otra contraseña. Para una EPS real, evaluar autenticadores TOTP o passkeys y los controles institucionales de identidad y recuperación. Referencia: [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html).
