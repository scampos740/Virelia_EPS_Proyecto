// Solo añade columnas; conserva usuarios, citas y solicitudes existentes.
export async function migrate(connection, domain) {
  // USE cambia la base durante db:init. Pasa su nombre como parámetro para
  // no depender del contexto de una sentencia preparada que mysql2 reutilice.
  const [[schema]] = await connection.query(
    "SELECT DATABASE() AS current_schema",
  );
  const columns =
    domain === "afiliados"
      ? [
          ["users", "email_verified", "TINYINT NOT NULL DEFAULT 0"],
          ["users", "role", "VARCHAR(16) NOT NULL DEFAULT 'paciente'"],
          ["users", "affiliation_date", "DATE NULL"],
          ["users", "specialty", "VARCHAR(80) NULL"],
          ["users", "affiliation_number", "VARCHAR(50) NULL"],
          [
            "beneficiaries",
            "tipo_documento",
            "VARCHAR(10) NOT NULL DEFAULT 'TI'",
          ],
        ]
      : domain === "citas"
        ? [
            ["slots", "doctor_id", "VARCHAR(36) NULL"],
            [
              "appointments",
              "paciente_nombre",
              "VARCHAR(201) NOT NULL DEFAULT ''",
            ],
          ]
        : domain === "notificaciones"
          ? [
              ["notifications", "attempts", "INT NOT NULL DEFAULT 0"],
              ["notifications", "next_attempt_at", "DATETIME NULL"],
              ["notifications", "email_text", "TEXT NULL"],
              [
                "notifications",
                "email_kind",
                "VARCHAR(30) NOT NULL DEFAULT 'notification'",
              ],
            ]
          : [];
  for (const [table, column, definition] of columns) {
    const [found] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?",
      [schema.current_schema, table, column],
    );
    if (!found.length)
      await connection.query(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
      );
  }

  if (domain === "citas") {
    const triggers = [
      [
        "clinical_final_immutable",
        "BEFORE UPDATE ON clinical_encounters FOR EACH ROW BEGIN IF OLD.status='Finalizada' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Finalized clinical record is immutable'; END IF; END",
      ],
      [
        "clinical_no_delete",
        "BEFORE DELETE ON clinical_encounters FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Clinical records cannot be deleted'",
      ],
      [
        "addenda_no_update",
        "BEFORE UPDATE ON clinical_addenda FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Addenda are immutable'",
      ],
      [
        "addenda_no_delete",
        "BEFORE DELETE ON clinical_addenda FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Addenda are immutable'",
      ],
    ];
    for (const [name, body] of triggers) {
      const [found] = await connection.execute(
        "SELECT TRIGGER_NAME FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA=? AND TRIGGER_NAME=?",
        [schema.current_schema, name],
      );
      if (!found.length)
        await connection.query(`CREATE TRIGGER ${name} ${body}`);
    }

    const [indexes] = await connection.execute(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME='slots' AND INDEX_NAME='doctor_time'",
      [schema.current_schema],
    );
    if (!indexes.length)
      await connection.query(
        "ALTER TABLE slots ADD UNIQUE KEY doctor_time(doctor_id,fecha,hora)",
      );
    const [old] = await connection.execute(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME='slots' AND INDEX_NAME='profesional'",
      [schema.current_schema],
    );
    if (old.length)
      await connection.query("ALTER TABLE slots DROP INDEX profesional");
  }
  if (domain === "afiliados") {
    for (const [table, key, columns, oldKey] of [
      ["users", "user_document", "tipo_documento,documento", "documento"],
      [
        "beneficiaries",
        "family_document",
        "user_id,tipo_documento,documento",
        "user_id",
      ],
    ]) {
      const [found] = await connection.execute(
        "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?",
        [schema.current_schema, table, key],
      );
      if (!found.length)
        await connection.query(
          `ALTER TABLE ${table} ADD UNIQUE KEY ${key}(${columns})`,
        );
      const [old] = await connection.execute(
        "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=? AND NON_UNIQUE=0",
        [schema.current_schema, table, oldKey],
      );
      if (old.length)
        await connection.query(`ALTER TABLE ${table} DROP INDEX ${oldKey}`);
    }
  }
}
