const request = require('supertest');
const jwt = require('jsonwebtoken');
const runMigrations = require('../database/migrate');
const seed = require('../database/seed');
const { pool } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const env = require('../src/config/env');
const app = require('../src/app');
const { toDateKeyInTimeZone } = require('../src/modules/alerts/alerts.time');
const { ensureTestDatabase, validateTestDbConnection } = require('./helpers/db-test-setup');

jest.setTimeout(180000);

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

function monthKeyFromDate(date) {
  return toDateKeyInTimeZone(date).slice(0, 7);
}

async function createUser(email) {
  const passwordHash = await hashPassword('Senha@123456');
  const [res] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [`FIN ${email}`, email, passwordHash, 'POLICE']
  );

  const userId = res.insertId;
  await pool.query(
    `INSERT INTO user_preferences (
      user_id, rule_b_enabled, payment_day_default, notification_prefs, monthly_hour_goal, planning_preferences
    )
    VALUES (?, ?, ?, CAST(? AS JSON), ?, CAST(? AS JSON))
    ON DUPLICATE KEY UPDATE
      rule_b_enabled = VALUES(rule_b_enabled),
      payment_day_default = VALUES(payment_day_default),
      notification_prefs = VALUES(notification_prefs),
      monthly_hour_goal = VALUES(monthly_hour_goal),
      planning_preferences = VALUES(planning_preferences)`,
    [userId, 0, 10, JSON.stringify({ email: true }), 120, JSON.stringify({})]
  );

  return userId;
}

async function getServiceTypeByKey(key) {
  const [rows] = await pool.query(
    'SELECT id, category, counts_in_financial FROM service_types WHERE `key` = ? LIMIT 1',
    [key]
  );
  return rows[0];
}

async function insertService(service) {
  await pool.query(
    `INSERT INTO services (
      user_id, service_type_id, start_at, duration_hours, operational_status, financial_status,
      amount_base, amount_paid, amount_balance, amount_meal, amount_transport,
      amount_additional, amount_discount, amount_total, payment_due_date, is_complementary, created_by, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      service.user_id,
      service.service_type_id,
      service.start_at,
      service.duration_hours,
      service.operational_status,
      service.financial_status,
      service.amount_base ?? service.amount_total ?? 0,
      service.amount_paid ?? 0,
      service.amount_balance ?? 0,
      0,
      0,
      0,
      0,
      service.amount_total ?? 0,
      service.payment_due_date ?? null,
      service.is_complementary ?? 1,
      service.created_by ?? service.user_id,
      service.deleted_at ?? null,
    ]
  );
}

describe('Finance MySQL Integration', () => {
  const userIds = [];

  beforeAll(async () => {
    await ensureTestDatabase();
    await validateTestDbConnection(pool);
    await runMigrations();
    await seed();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM services');
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await pool.query('DELETE FROM user_preferences WHERE user_id IN (?)', [userIds]);
      await pool.query('DELETE FROM users WHERE id IN (?)', [userIds]);
    }
    await pool.end();
  });

  test('summary/report com filtros, soft delete, overdue de borda e exclusao de ordinaria', async () => {
    const userId = await createUser(`finance_db_${Date.now()}@local`);
    userIds.push(userId);

    const rasType = await getServiceTypeByKey('ras_voluntary');
    const ordinaryType = await getServiceTypeByKey('ordinary_shift');

    const now = new Date();
    const monthKey = monthKeyFromDate(now);
    const todayKey = toDateKeyInTimeZone(now);
    const yesterdayKey = toDateKeyInTimeZone(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const monthStartDate = `${monthKey}-05`;

    await insertService({
      user_id: userId,
      service_type_id: rasType.id,
      start_at: `${monthStartDate} 10:00:00`,
      duration_hours: 12,
      operational_status: 'REALIZADO',
      financial_status: 'PAGO',
      amount_total: 200,
      amount_paid: 200,
      amount_balance: 0,
      payment_due_date: `${monthKey}-10`,
    });

    await insertService({
      user_id: userId,
      service_type_id: rasType.id,
      start_at: `${monthStartDate} 12:00:00`,
      duration_hours: 8,
      operational_status: 'REALIZADO',
      financial_status: 'PAGO_PARCIAL',
      amount_total: 180,
      amount_paid: 100,
      amount_balance: 80,
      payment_due_date: `${monthKey}-11`,
    });

    await insertService({
      user_id: userId,
      service_type_id: rasType.id,
      start_at: `${monthStartDate} 14:00:00`,
      duration_hours: 6,
      operational_status: 'TITULAR',
      financial_status: 'NAO_PAGO',
      amount_total: 120,
      amount_paid: 0,
      amount_balance: 120,
      payment_due_date: yesterdayKey,
    });

    await insertService({
      user_id: userId,
      service_type_id: rasType.id,
      start_at: `${monthStartDate} 16:00:00`,
      duration_hours: 6,
      operational_status: 'TITULAR',
      financial_status: 'NAO_PAGO',
      amount_total: 70,
      amount_paid: 0,
      amount_balance: 70,
      payment_due_date: todayKey,
    });

    await insertService({
      user_id: userId,
      service_type_id: ordinaryType.id,
      start_at: `${monthStartDate} 18:00:00`,
      duration_hours: 24,
      operational_status: 'REALIZADO',
      financial_status: 'PAGO',
      amount_total: 500,
      amount_paid: 500,
      amount_balance: 0,
      payment_due_date: `${monthKey}-20`,
      is_complementary: 0,
    });

    await insertService({
      user_id: userId,
      service_type_id: rasType.id,
      start_at: `${monthStartDate} 20:00:00`,
      duration_hours: 12,
      operational_status: 'REALIZADO',
      financial_status: 'PAGO',
      amount_total: 150,
      amount_paid: 150,
      amount_balance: 0,
      payment_due_date: `${monthKey}-21`,
      deleted_at: `${monthStartDate} 21:00:00`,
    });

    const summary = await request(app)
      .get(`/api/v1/finance/summary?month=${monthKey}`)
      .set('Authorization', authHeader({ id: userId, role: 'POLICE', email: 'x@local' }));

    expect(summary.status).toBe(200);
    expect(summary.body.data.total_expected).toBe(570);
    expect(summary.body.data.total_received).toBe(200);
    expect(summary.body.data.total_pending).toBe(270);
    expect(summary.body.data.total_overdue).toBe(120);

    const report = await request(app)
      .get(
        `/api/v1/finance/report?start_date=${monthKey}-01&end_date=${monthKey}-31&service_type=ras_voluntary&financial_status=NAO_PAGO`
      )
      .set('Authorization', authHeader({ id: userId, role: 'POLICE', email: 'x@local' }));

    expect(report.status).toBe(200);
    expect(report.body.data.items.length).toBe(2);
    expect(report.body.data.items.every((item) => item.financial_status === 'NAO_PAGO')).toBe(true);
    expect(report.body.data.by_service_type.length).toBe(1);
    expect(report.body.data.by_service_type[0].service_type).toBe('ras_voluntary');
  });
});
