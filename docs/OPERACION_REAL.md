# Pendientes para operar con pacientes reales

La aplicación implementa controles técnicos y flujos funcionales. No se ha habilitado una EPS real, verificado una entidad prestadora ni certificado cumplimiento sanitario. El sitio no incluye firmas, sellos o acreditaciones inventados.

## Decisiones institucionales necesarias

- Identificar responsable del tratamiento, entidad jurídica, canales oficiales, finalidades y aviso/política de privacidad aprobados. El checkbox de registro autoriza el trámite dentro del flujo, pero no sustituye el contenido jurídico ni la evidencia institucional de autorización para información sensible. Definir tratamiento de menores y representación.
- Determinar si Virelia actuará como EPS, IPS, portal de un prestador o proyecto académico. La facultad de registrar y custodiar información clínica, la identificación del profesional y los accesos asistenciales dependen de esa condición. Verificar profesionales y su vinculación antes de crear roles de doctor.
- Definir mecanismo de firma/identificación clínica jurídicamente aceptado, roles de consulta autorizada y validación de contenido mínimo por disciplina. El registro usa identidad de cuenta, fecha y auditoría; no implementa una firma digital certificada ni interoperabilidad IHCE/RDA.
- Aprobar retención, custodia, acceso, traslado y disposición final de historia clínica. La Resolución 839 de 2017 establece conservación mínima de 15 años desde la última atención con excepciones de mayor plazo. Backups operativos de 35 días no equivalen a conservación documental.
- Revisar transferencias/transmisiones internacionales, contratos con encargados, ubicación del alojamiento futuro, correo y respuesta a incidentes. Aprobar derechos de titulares y canales de atención. Documentar quién responde PQRS y mediante qué procedimiento; el portal conserva radicación y aportes, pero no inventa un equipo de respuesta ni un panel administrador que no existía.
- Evaluar interoperabilidad y RDA según la condición institucional y normativa aplicable. El portal oficial de MinSalud consultado incluye Ley 2015 de 2020, Resoluciones 866 de 2021, 1888 de 2025 y 1799 de 2026, además de las reglas de historia clínica y datos personales. Un PDF descargable no implementa esa interoperabilidad.

## Validaciones técnicas pendientes de operación

Cuando decidas el alojamiento, aprobar presupuesto y ubicación, aplicar grants limitados, verificar TLS, dominio y entrega SMTP real, revisar registros y alertas, realizar un ensayo de recuperación, programar copias aisladas e inmutables y revisar capacidad y alta disponibilidad. Efectuar pruebas visuales en Windows, celular y navegadores, revisión de accesibilidad y una evaluación de seguridad autorizada. El entorno de este trabajo impidió iniciar Chromium por restricciones de IPC; las pruebas de componentes y responsive no sustituyen esa revisión visual.

El remitente Gmail dedicado se conserva mediante tu `.env` privado. La plataforma debe comprobar entrega y cuotas en producción. No enviar información clínica detallada en el asunto o cuerpo de los correos de citas. El código envía un aviso genérico y pide consultar el portal autenticado.

## Referencias oficiales consultadas

- [Ley 1581 de 2012](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981): datos sensibles, autorizaciones y principios del tratamiento.
- [Resolución 1995 de 1999 en SuperSalud](https://normograma.supersalud.gov.co/compilacion/docs/resolucion_minsalud_r1995_99.htm): reserva, registro y custodia de historia clínica.
- [Resolución 839 de 2017](https://www.minsalud.gov.co/Normatividad_Nuevo/Resolucion%20No%20839%20de%202017.pdf): conservación y gestión del expediente.
- [Normatividad IHCE de MinSalud](https://www.minsalud.gov.co/ihce/Paginas/Normatividad.aspx): revisar el texto vigente y aplicabilidad con el responsable.

Estas referencias identifican obligaciones que deben validarse con responsables jurídicos, clínicos y de datos; no representan un dictamen de cumplimiento legal.
