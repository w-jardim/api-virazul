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
    [`REP ${email}`, email, passwordHash, 'POLICE']
  );

  const userId = res.insertId;
  await pool.query(
    `INSERT INTO user_preferences (
      user_id, rule_b_enabled, payment_day_default, notification_prefs, monthly_hour_goal, planning_preferences
    ) VALUES (?, ?, ?, CAST(? AS JSON), ?, CAST(? AS JSON))
    ON DUPLICATE KEY UPDATE notification_prefs = VALUES(notification_prefs)`,
    [userId, 0, 10, JSON.stringify({ email: true }), 120, JSON.stringify({})]
  );

  return userId;
}

async function getTypeByKey(key) {
  const [rows] = await pool.query('SELECT id FROM service_types WHERE `key` = ? LIMIT 1', [key]);
  return rows[0].id;
}

async function insertService(service) {
  const [res] = await pool.query(
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

  return res.insertId;
}

async function insertReservationTransition(serviceId, changedBy, newStatus) {
  await pool.query(
    `INSERT INTO service_status_history (
      service_id, previous_operational_status, previous_financial_status,
      new_operational_status, new_financial_status, transition_type, changed_by, reason
    ) VALUES (?, 'RESERVA', 'PREVISTO', ?, 'PREVISTO', 'TEST', ?, 'test')`,
    [serviceId, newStatus, changedBy]
  );
}

describe('Reports MySQL Integration', () => {
  const userIds = [];

  beforeAll(async () => {
    await ensureTestDatabase();
    await validateTestDbConnection(pool);
    await runMigrations();
    await seed();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM service_status_history');
    await pool.query('DELETE FROM services');
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await pool.query('DELETE FROM user_preferences WHERE user_id IN (?)', [userIds]);
      await pool.query('DELETE FROM users WHERE id IN (?)', [userIds]);
    }
    await pool.end();
  });

  test('operational/financial com filtros, overdue borda, tipos zerados, ordinaria excluida e isolamento', async () => {
    const userA = await createUser(`reports_a_${Date.now()}@local`);
    const userB = await createUser(`reports_b_${Date.now()}@local`);
    userIds.push(userA, userB);

    const rasType = await getTypeByKey('ras_voluntary');
    const proeisType = await getTypeByKey('proeis');
    const ordinaryType = await getTypeByKey('ordinary_shift');

    const now = new Date();
    const monthKey = monthKeyFromDate(now);
    const day = `${monthKey}-10`;
    const yesterday = toDateKeyInTimeZone(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const today = toDateKeyInTimeZone(now);

    const reservaId = await insertService({
      user_id: userA,
      service_type_id: rasType,
      start_at: `${day} 08:00:00`,
      duration_hours: 8,
      operational_status: 'RESERVA',
      financial_status: 'PREVISTO',
      amount_total: 80,
      amount_paid: 0,
      amount_balance: 80,
    });
    await insertReservationTransition(reservaId, userA, 'CONVERTIDO_TITULAR');

    await insertService({
      user_id: userA,
      service_type_id: proeisType,
      start_at: `${day} 10:00:00`,
      duration_hours: 12,
      operational_status: 'REALIZADO',
      financial_status: 'PAGO',
      amount_total: 200,
      amount_paid: 200,
      amount_balance: 0,
      payment_due_date: today,
    });

    await insertService({
      user_id: userA,
      service_type_id: rasType,
      start_at: `${day} 12:00:00`,
      duration_hours: 6,
      operational_status: 'TITULAR',
      financial_status: 'NAO_PAGO',
      amount_total: 100,
      amount_paid: 0,
      amount_balance: 100,
      payment_due_date: yesterday,
    });

    await insertService({
      user_id: userA,
      service_type_id: ordinaryType,
      start_at: `${day} 14:00:00`,
      duration_hours: 24,
      operational_status: 'REALIZADO',
      financial_status: 'PAGO',
      amount_total: 500,
      amount_paid: 500,
      amount_balance: 0,
      payment_due_date: yesterday,
      is_complementary: 0,
    });

    await insertService({
      user_id: userB,
      service_type_id: rasType,
      start_at: `${day} 16:00:00`,
      duration_hours: 12,
      operational_status: 'REALIZADO',
      financial_status: 'PAGO',
      amount_total: 999,
      amount_paid: 999,
      amount_balance: 0,
      payment_due_date: yesterday,
    });

    const op = await request(app)
      .get(`/api/v1/reports/operational?start_date=${monthKey}-01&end_date=${monthKey}-31`)
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@local' }));

    expect(op.status).toBe(200);
    expect(op.body.data.summary.total_services).toBe(4);
    expect(op.body.data.reservation_metrics.total_reservations).toBe(2);
    expect(op.body.data.reservation_metrics.converted_reservations).toBe(1);

    const fin = await request(app)
      .get(`/api/v1/reports/financial?start_date=${monthKey}-01&end_date=${monthKey}-31`)
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@local' }));

    expect(fin.status).toBe(200);
    expect(fin.body.data.summary.total_expected).toBe(300);
    expect(fin.body.data.summary.total_received).toBe(200);
    expect(fin.body.data.summary.total_pending).toBe(100);
    expect(fin.body.data.summary.total_overdue).toBe(100);
    expect(fin.body.data.by_service_type.ordinary_shift).toBe(0);
    expect(fin.body.data.by_service_type.ras_compulsory).toBe(0);

    const finFiltered = await request(app)
      .get(
        `/api/v1/reports/financial?start_date=${monthKey}-01&end_date=${monthKey}-31&service_type=ras_voluntary&financial_status=NAO_PAGO`
      )
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@local' }));

    expect(finFiltered.status).toBe(200);
    expect(finFiltered.body.data.summary.total_expected).toBe(100);
    expect(finFiltered.body.data.by_financial_status.NAO_PAGO).toBe(100);
  });
});
