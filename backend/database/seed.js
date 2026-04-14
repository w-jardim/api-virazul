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
      accounting_rules: { ruleBApplicable: false, service_scope: 'ORDINARY' },
    },
    {
      key: 'ras_voluntary',
      name: 'RAS Voluntario',
      category: 'RAS',
      allows_reservation: 1,
      requires_manual_value: 0,
      counts_in_financial: 1,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: true, compulsory: false, service_scope: 'RAS_VOLUNTARY' },
    },
    {
      key: 'ras_compulsory',
      name: 'RAS Compulsorio',
      category: 'RAS',
      allows_reservation: 0,
      requires_manual_value: 0,
      counts_in_financial: 1,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: true, compulsory: true, service_scope: 'RAS_COMPULSORY' },
    },
    {
      key: 'proeis',
      name: 'PROEIS',
      category: 'PROEIS',
      allows_reservation: 1,
      requires_manual_value: 0,
      counts_in_financial: 1,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: true, service_scope: 'PROEIS' },
    },
    {
      key: 'seguranca_presente',
      name: 'Seguranca Presente',
      category: 'SEGURANCA_PRESENTE',
      allows_reservation: 1,
      requires_manual_value: 0,
      counts_in_financial: 1,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: true, service_scope: 'SEGURANCA_PRESENTE' },
    },
    {
      key: 'other',
      name: 'Outros',
      category: 'OTHER',
      allows_reservation: 1,
      requires_manual_value: 1,
      counts_in_financial: 1,
      shows_in_agenda: 1,
      accounting_rules: { ruleBApplicable: true, service_scope: 'OTHER' },
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

async function seedPricingRules(connection) {
  const baseValues = [
    // OFICIAIS_SUPERIORES
    { rank_group: 'OFICIAIS_SUPERIORES', duration_hours: 6, base_amount: 378.04 },
    { rank_group: 'OFICIAIS_SUPERIORES', duration_hours: 8, base_amount: 504.04 },
    { rank_group: 'OFICIAIS_SUPERIORES', duration_hours: 12, base_amount: 756.07 },
    { rank_group: 'OFICIAIS_SUPERIORES', duration_hours: 24, base_amount: 1512.14 },
    // CAPITAO_TENENTE
    { rank_group: 'CAPITAO_TENENTE', duration_hours: 6, base_amount: 302.70 },
    { rank_group: 'CAPITAO_TENENTE', duration_hours: 8, base_amount: 403.23 },
    { rank_group: 'CAPITAO_TENENTE', duration_hours: 12, base_amount: 604.85 },
    { rank_group: 'CAPITAO_TENENTE', duration_hours: 24, base_amount: 1209.69 },
    // SUBTENENTE_SARGENTO
    { rank_group: 'SUBTENENTE_SARGENTO', duration_hours: 6, base_amount: 226.82 },
    { rank_group: 'SUBTENENTE_SARGENTO', duration_hours: 8, base_amount: 302.42 },
    { rank_group: 'SUBTENENTE_SARGENTO', duration_hours: 12, base_amount: 453.64 },
    { rank_group: 'SUBTENENTE_SARGENTO', duration_hours: 24, base_amount: 907.27 },
    // CABO_SOLDADO
    { rank_group: 'CABO_SOLDADO', duration_hours: 6, base_amount: 191.53 },
    { rank_group: 'CABO_SOLDADO', duration_hours: 8, base_amount: 255.37 },
    { rank_group: 'CABO_SOLDADO', duration_hours: 12, base_amount: 383.05 },
    { rank_group: 'CABO_SOLDADO', duration_hours: 24, base_amount: 766.11 },
  ];

  for (const row of baseValues) {
    await connection.query(
      `INSERT INTO pricing_base_values (
        rank_group,
        duration_hours,
        base_amount,
        effective_start_date,
        effective_end_date,
        is_active
      ) VALUES (?, ?, ?, '2024-01-01', NULL, 1)
      ON DUPLICATE KEY UPDATE
        base_amount = VALUES(base_amount),
        effective_end_date = VALUES(effective_end_date),
        is_active = VALUES(is_active)`,
      [row.rank_group, row.duration_hours, row.base_amount]
    );
  }

  const financialRules = [
    { service_scope: 'RAS_VOLUNTARY', allow_transport: 1, transport_amount: 17.10, allow_meal: 0, meal_amount: 0 },
    { service_scope: 'RAS_COMPULSORY', allow_transport: 1, transport_amount: 17.10, allow_meal: 0, meal_amount: 0 },
    { service_scope: 'PROEIS', allow_transport: 1, transport_amount: 17.10, allow_meal: 1, meal_amount: 61.26 },
    { service_scope: 'SEGURANCA_PRESENTE', allow_transport: 1, transport_amount: 17.10, allow_meal: 1, meal_amount: 61.26 },
    { service_scope: 'OTHER', allow_transport: 0, transport_amount: 0, allow_meal: 0, meal_amount: 0 },
    { service_scope: 'ORDINARY', allow_transport: 0, transport_amount: 0, allow_meal: 0, meal_amount: 0 },
  ];

  for (const row of financialRules) {
    await connection.query(
      `INSERT INTO service_type_financial_rules (
        service_scope,
        allow_transport,
        transport_amount,
        allow_meal,
        meal_amount,
        effective_start_date,
        effective_end_date,
        is_active
      ) VALUES (?, ?, ?, ?, ?, '2024-01-01', NULL, 1)
      ON DUPLICATE KEY UPDATE
        allow_transport = VALUES(allow_transport),
        transport_amount = VALUES(transport_amount),
        allow_meal = VALUES(allow_meal),
        meal_amount = VALUES(meal_amount),
        effective_end_date = VALUES(effective_end_date),
        is_active = VALUES(is_active)`,
      [row.service_scope, row.allow_transport, row.transport_amount, row.allow_meal, row.meal_amount]
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

    // Set rank_group for the police test user (requires migration 021)
    await connection.query(
      `UPDATE users SET rank_group = 'CABO_SOLDADO' WHERE email = ?`,
      [policeEmail]
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
      `INSERT INTO user_preferences (
         user_id,
         rule_b_enabled,
         payment_day_default,
         notification_prefs,
         monthly_hour_goal,
         planning_preferences
       )
       VALUES (?, ?, ?, CAST(? AS JSON), ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE
         rule_b_enabled = VALUES(rule_b_enabled),
         payment_day_default = VALUES(payment_day_default),
         notification_prefs = VALUES(notification_prefs),
         monthly_hour_goal = VALUES(monthly_hour_goal),
         planning_preferences = VALUES(planning_preferences)`,
      [
        adminId,
        1,
        5,
        JSON.stringify({ email: true, push: true, whatsapp: false }),
        120,
        JSON.stringify({
          preferred_durations: [8, 12],
          avoided_durations: [24],
          max_single_shift_hours: 12,
        }),
      ]
    );

    await connection.query(
      `INSERT INTO user_preferences (
         user_id,
         rule_b_enabled,
         payment_day_default,
         notification_prefs,
         monthly_hour_goal,
         planning_preferences
       )
       VALUES (?, ?, ?, CAST(? AS JSON), ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE
         rule_b_enabled = VALUES(rule_b_enabled),
         payment_day_default = VALUES(payment_day_default),
         notification_prefs = VALUES(notification_prefs),
         monthly_hour_goal = VALUES(monthly_hour_goal),
         planning_preferences = VALUES(planning_preferences)`,
      [
        policeId,
        0,
        10,
        JSON.stringify({ email: true, push: false, whatsapp: false }),
        120,
        JSON.stringify({
          preferred_durations: [12],
          avoided_durations: [],
          max_single_shift_hours: 24,
        }),
      ]
    );

    await seedServiceTypes(connection);
    await seedPricingRules(connection);

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
