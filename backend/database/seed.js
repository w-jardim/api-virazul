const { pool } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

async function seedServiceTypes(connection) {
  const serviceTypes = [
    {
      key: 'ordinary_shift',
      name: 'Escala Ordinaria',
      category: 'ORDINARY',
      allows_reservation: 0,
      requires_manual_value: 0,
      counts_in_financial: 0,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: false },
    },
    {
      key: 'ras_voluntary',
      name: 'RAS Voluntario',
      category: 'RAS',
      allows_reservation: 1,
      requires_manual_value: 0,
      counts_in_financial: 1,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: true, compulsory: false },
    },
    {
      key: 'ras_compulsory',
      name: 'RAS Compulsorio',
      category: 'RAS',
      allows_reservation: 0,
      requires_manual_value: 0,
      counts_in_financial: 1,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: true, compulsory: true },
    },
    {
      key: 'proeis',
      name: 'PROEIS',
      category: 'PROEIS',
      allows_reservation: 1,
      requires_manual_value: 0,
      counts_in_financial: 1,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: true },
    },
    {
      key: 'other',
      name: 'Outros',
      category: 'OTHER',
      allows_reservation: 1,
      requires_manual_value: 1,
      counts_in_financial: 1,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: true },
    },
  ];

  for (const type of serviceTypes) {
    await connection.query(
      `INSERT INTO service_types (
        \`key\`,
        name,
        category,
        allows_reservation,
        requires_manual_value,
        counts_in_financial,
        shows_in_agenda,
        accounting_rules
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        allows_reservation = VALUES(allows_reservation),
        requires_manual_value = VALUES(requires_manual_value),
        counts_in_financial = VALUES(counts_in_financial),
        shows_in_agenda = VALUES(shows_in_agenda),
        accounting_rules = VALUES(accounting_rules)`,
      [
        type.key,
        type.name,
        type.category,
        type.allows_reservation,
        type.requires_manual_value,
        type.counts_in_financial,
        type.shows_in_agenda,
        JSON.stringify(type.accounting_rules),
      ]
    );
  }
}

async function seed() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const adminEmail = 'admin.master@viraazul.local';
    const policeEmail = 'policial.teste@viraazul.local';

    const adminPasswordHash = await hashPassword('Admin@123456');
    const policePasswordHash = await hashPassword('Policial@123456');

    await connection.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'ADMIN_MASTER')
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         password_hash = VALUES(password_hash),
         role = VALUES(role)`,
      ['Admin Master', adminEmail, adminPasswordHash]
    );

    await connection.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'POLICE')
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         password_hash = VALUES(password_hash),
         role = VALUES(role)`,
      ['Policial Teste', policeEmail, policePasswordHash]
    );

    const [adminRows] = await connection.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [adminEmail]
    );

    const [policeRows] = await connection.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [policeEmail]
    );

    const adminId = adminRows[0].id;
    const policeId = policeRows[0].id;

    await connection.query(
      `INSERT INTO user_preferences (user_id, rule_b_enabled, payment_day_default, notification_prefs)
       VALUES (?, ?, ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE
         rule_b_enabled = VALUES(rule_b_enabled),
         payment_day_default = VALUES(payment_day_default),
         notification_prefs = VALUES(notification_prefs)`,
      [adminId, 1, 5, JSON.stringify({ email: true, push: true, whatsapp: false })]
    );

    await connection.query(
      `INSERT INTO user_preferences (user_id, rule_b_enabled, payment_day_default, notification_prefs)
       VALUES (?, ?, ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE
         rule_b_enabled = VALUES(rule_b_enabled),
         payment_day_default = VALUES(payment_day_default),
         notification_prefs = VALUES(notification_prefs)`,
      [policeId, 0, 10, JSON.stringify({ email: true, push: false, whatsapp: false })]
    );

    await seedServiceTypes(connection);

    await connection.commit();
    console.log('Seed finished successfully.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed error:', error);
      process.exit(1);
    });
}

module.exports = seed;

