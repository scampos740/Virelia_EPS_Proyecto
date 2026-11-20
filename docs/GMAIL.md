# Gmail para enviar notificaciones

## Configuración sencilla

Con las dependencias instaladas y `.env` creado por `npm run setup`, ejecuta `npm run mail:setup`. El asistente pide el correo remitente y una contraseña de aplicación Google de 16 caracteres; la clave no se muestra. Comprueba la conexión antes de guardar, preserva las variables MySQL y activa `REQUIRE_EMAIL_VERIFICATION=true` y `EMAIL_LOGIN_OTP=true`. No envía mensajes de prueba. Reinicia el portal después.

Crea la contraseña desde <https://myaccount.google.com/apppasswords>, con verificación en dos pasos activada. Algunas cuentas educativas/laborales o con Protección avanzada no permiten contraseñas de aplicación; su administrador debe habilitar un método admitido. No desactives medidas de la cuenta ni uses la contraseña habitual.

## Alternativa manual

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-cuenta@gmail.com
SMTP_PASSWORD=contraseña_de_aplicacion
MAIL_FROM=Virelia <tu-cuenta@gmail.com>
REQUIRE_EMAIL_VERIFICATION=true
EMAIL_LOGIN_OTP=true
PUBLIC_APP_URL=http://127.0.0.1:5173
```

`SMTP_SECURE=false` en 587 inicia la conexión con STARTTLS obligatorio; no significa enviar la contraseña sin cifrado. El enlace local solo funciona en el computador que ejecuta el portal. Si abres el correo desde otro dispositivo, configura una URL del portal accesible desde ese dispositivo. En publicación debe ser HTTPS. Mantén `.env` privado.

## Prueba de entrega

1. Ejecuta `npm run mail:check` para validar autenticación sin enviar correo.
2. Reinicia `npm run dev` y registra una cuenta con un correo que controles. Recibirás el enlace de verificación; vence en 30 minutos.
3. Confirma, inicia sesión con contraseña y el código de seis dígitos recibido, y reserva una cita. Espera la cola de entrega y revisa spam.
4. En Correo y notificaciones comprueba destinatario y estado. Enviado significa aceptado por SMTP; no confirma lectura ni llegada a la bandeja principal.

Los correos se envían al email registrado por cada persona. El servicio no crea buzones Gmail ni lee correos. Se conserva un historial interno y las preferencias de otros avisos; los códigos de acceso, la verificación y las reservas, reprogramaciones y cancelaciones de citas se envían aunque desactives los otros avisos.

Los avisos pendientes sobreviven a caídas gracias a MySQL/outbox. Cada fallo de envío incrementa intentos y programa otro intento con espera creciente (máximo una hora), sin bloquear los otros destinatarios. Al configurar correo se retoman avisos con estado Sin configurar; esto también puede incluir avisos anteriores. El transporte es al menos una vez: una caída después del envío y antes de registrar su resultado puede duplicar un correo. Los enlaces de verificación vencidos requieren solicitar uno nuevo.

No se incluyeron credenciales personales en el proyecto ni se verificó entrega real a Gmail durante la preparación del ZIP. Se prueba SMTP con un receptor local. La conexión final requiere que ingreses tu credencial local mediante el asistente.

Referencias oficiales: [Google: contraseñas de aplicación](https://support.google.com/accounts/answer/185833?hl=es) y [SMTP de Gmail](https://developers.google.com/workspace/gmail/imap/imap-smtp?hl=es-419).

La página independiente de Notificaciones se retiró en esta versión; los envíos automáticos permanecen. Recuperación usa un enlace de 15 minutos y requiere PUBLIC_APP_URL correcto. El despliegue externo se configurará más adelante; esta entrega conserva tu remitente local.
