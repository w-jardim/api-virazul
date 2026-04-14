const request = require('supertest');
const jwt = require('jsonwebtoken');
const runMigrations = require('../database/migrate');
const seed = require('../database/seed');
const { pool } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const env = require('../src/config/env');
const app = require('../src/app');
const { ensureTestDatabase, validateTestDbConnection } = require('./helpers/db-test-setup');

jest.setTimeout(180000);

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

async function createUser(email) {
  const passwordHash = await hashPassword('Senha@123456');
  const [res] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [`IT ${email}`, email, passwordHash, 'POLICE']
  );

  const userId = res.insertId;

  await pool.query(
    `INSERT INTO user_preferences (user_id, rule_b_enabled, payment_day_default, notification_prefs)
     VALUES (?, ?, ?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE
       rule_b_enabled = VALUES(rule_b_enabled),
       payment_day_default = VALUES(payment_day_default),
       notification_prefs = VALUES(notification_prefs)`,
    [userId, 0, 10, JSON.stringify({ email: true })]
  );

  return userId;
}

async function getServiceTypeIdByKey(key) {
  const [rows] = await pool.query('SELECT id FROM service_types WHERE `key` = ? LIMIT 1', [key]);
  return rows[0].id;
}

describe('Alerts MySQL Integration', () => {
  const userIds = [];

  beforeAll(async () => {
    await ensureTestDatabase();
    await validateTestDbConnection(pool);
    await runMigrations();
    await seed();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM alerts');
    await pool.query('DELETE FROM services');
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await pool.query('DELETE FROM user_preferences WHERE user_id IN (?)', [userIds]);
      await pool.query('DELETE FROM users WHERE id IN (?)', [userIds]);
    }
    await pool.end();
  });

  test('persistencia, deduplicacao e atualizacao de status de alerta', async () => {
    const userId = await createUser(`alerts_db_${Date.now()}@local`);
    userIds.push(userId);

    const serviceTypeId = await getServiceTypeIdByKey('ras_voluntary');

    const today = new Date();
    const [serviceRes] = await pool.query(
      `INSERT INTO services (
        user_id, service_type_id, start_at, duration_hours, operational_status, financial_status,
        amount_base, amount_paid, amount_balance, amount_meal, amount_transport,
        amount_additional, amount_discount, amount_total, is_complementary, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        serviceTypeId,
        today,
        12,
        'TITULAR',
        'PREVISTO',
        100,
        0,
        100,
        0,
        0,
        0,
        0,
        100,
        1,
        userId,
      ]
    );

    expect(serviceRes.insertId).toBeTruthy();

    const first = await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: userId, role: 'POLICE', email: 'u@local' }));

    const second = await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: userId, role: 'POLICE', email: 'u@local' }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const [rows] = await pool.query('SELECT * FROM alerts WHERE user_id = ? AND deleted_at IS NULL', [userId]);
    expect(rows.length).toBe(1);

    const alertId = rows[0].id;

    const read = await request(app)
      .post(`/api/v1/alerts/${alertId}/read`)
      .set('Authorization', authHeader({ id: userId, role: 'POLICE', email: 'u@local' }));

    expect(read.status).toBe(200);
    expect(read.body.data.status).toBe('READ');

    const dismiss = await request(app)
      .post(`/api/v1/alerts/${alertId}/dismiss`)
      .set('Authorization', authHeader({ id: userId, role: 'POLICE', email: 'u@local' }));

    expect(dismiss.status).toBe(200);
    expect(dismiss.body.data.status).toBe('DISMISSED');
  });

  test('isolamento por usuario e dashboard summary funcional', async () => {
    const userA = await createUser(`alerts_db_a_${Date.now()}@local`);
    const userB = await createUser(`alerts_db_b_${Date.now()}@local`);
    userIds.push(userA, userB);

    const serviceTypeId = await getServiceTypeIdByKey('ras_voluntary');

    await pool.query(
      `INSERT INTO services (
        user_id, service_type_id, start_at, duration_hours, operational_status, financial_status,
        amount_base, amount_paid, amount_balance, amount_meal, amount_transport,
        amount_additional, amount_discount, amount_total, is_complementary, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userA,
        serviceTypeId,
        new Date(),
        8,
        'RESERVA',
        'PREVISTO',
        80,
        0,
        80,
        0,
        0,
        0,
        0,
        80,
        1,
        userA,
      ]
    );

    await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@local' }));

    const bRead = await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: userB, role: 'POLICE', email: 'b@local' }));

    expect(bRead.status).toBe(200);
    expect(Array.isArray(bRead.body.data)).toBe(true);
    expect(bRead.body.data.length).toBe(0);

    const summary = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@local' }));

    expect(summary.status).toBe(200);
    expect(summary.body.data.today.reservations.length).toBeGreaterThanOrEqual(1);
  });
});
