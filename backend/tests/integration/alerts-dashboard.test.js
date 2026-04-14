const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockState = {
  alerts: [],
  services: [],
  nextAlertId: 1,
};

function mockStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mockIsToday(value) {
  const now = new Date();
  return mockStartOfDay(value).getTime() === mockStartOfDay(now).getTime();
}

jest.mock('../../src/modules/alerts/alerts.repository', () => ({
  listByUser: jest.fn(async (userId, filters = {}) =>
    mockState.alerts
      .filter((item) => Number(item.user_id) === Number(userId) && !item.deleted_at)
      .filter((item) => (filters.type ? item.alert_type === filters.type : true))
      .filter((item) => (filters.status ? item.status === filters.status : true))
      .sort((a, b) => Number(b.id) - Number(a.id))
  ),
  findByIdAndUser: jest.fn(async (alertId, userId) =>
    mockState.alerts.find(
      (item) =>
        Number(item.id) === Number(alertId) &&
        Number(item.user_id) === Number(userId) &&
        !item.deleted_at
    ) || null
  ),
  markStatus: jest.fn(async (alertId, userId, status) => {
    const idx = mockState.alerts.findIndex(
      (item) =>
        Number(item.id) === Number(alertId) &&
        Number(item.user_id) === Number(userId) &&
        !item.deleted_at
    );

    if (idx < 0) {
      return null;
    }

    mockState.alerts[idx] = {
      ...mockState.alerts[idx],
      status,
      read_at: status === 'READ' ? new Date().toISOString() : mockState.alerts[idx].read_at,
    };

    return mockState.alerts[idx];
  }),
  getAlertsByDedupeKeys: jest.fn(async (userId, dedupeKeys) =>
    mockState.alerts.filter(
      (item) => Number(item.user_id) === Number(userId) && dedupeKeys.includes(item.dedupe_key)
    )
  ),
  insertAlertsBatch: jest.fn(async (alerts) => {
    for (const payload of alerts) {
      const existing = mockState.alerts.find((item) => item.dedupe_key === payload.dedupe_key);

      if (existing) {
        if (!['READ', 'DISMISSED'].includes(existing.status)) {
          existing.status = 'ACTIVE';
          existing.deleted_at = null;
          existing.read_at = null;
        }
        existing.payload = payload.payload;
        continue;
      }

      mockState.alerts.push({
        id: mockState.nextAlertId++,
        user_id: payload.user_id,
        alert_type: payload.alert_type,
        related_service_id: payload.related_service_id || null,
        dedupe_key: payload.dedupe_key,
        payload: payload.payload || {},
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        read_at: null,
        deleted_at: null,
      });
    }
  }),
  listActiveGeneratedAlerts: jest.fn(async (userId) =>
    mockState.alerts.filter(
      (item) =>
        Number(item.user_id) === Number(userId) &&
        item.status === 'ACTIVE' &&
        !item.deleted_at &&
        ['DAY', 'OPERATIONAL', 'FINANCIAL'].includes(item.alert_type)
    )
  ),
  softDeleteByIds: jest.fn(async (ids) => {
    for (const id of ids) {
      const idx = mockState.alerts.findIndex((item) => Number(item.id) === Number(id));
      if (idx >= 0 && mockState.alerts[idx].status === 'ACTIVE') {
        mockState.alerts[idx] = {
          ...mockState.alerts[idx],
          deleted_at: new Date().toISOString(),
        };
      }
    }
  }),
  getTodayServices: jest.fn(async (userId, start, end) =>
    mockState.services.filter(
      (item) =>
        Number(item.user_id) === Number(userId) &&
        !item.deleted_at &&
        new Date(item.start_at) >= new Date(start) &&
        new Date(item.start_at) < new Date(end)
    )
  ),
  getOperationalPendingServices: jest.fn(async (userId, nowDate) =>
    mockState.services.filter(
      (item) =>
        Number(item.user_id) === Number(userId) &&
        !item.deleted_at &&
        new Date(item.start_at) < new Date(nowDate) &&
        !['REALIZADO', 'FALTOU', 'CANCELADO', 'NAO_CONVERTIDO'].includes(item.operational_status)
    )
  ),
  getFinancialPendingServices: jest.fn(async (userId, dayStart) =>
    mockState.services.filter(
      (item) =>
        Number(item.user_id) === Number(userId) &&
        !item.deleted_at &&
        item.operational_status === 'REALIZADO' &&
        ['PREVISTO', 'NAO_PAGO'].includes(item.financial_status) &&
        item.payment_due_date &&
        new Date(item.payment_due_date) < mockStartOfDay(dayStart)
    )
  ),
  countActiveAlerts: jest.fn(async (userId) =>
    mockState.alerts.filter(
      (item) => Number(item.user_id) === Number(userId) && item.status === 'ACTIVE' && !item.deleted_at
    ).length
  ),
}));

jest.mock('../../src/modules/dashboard/dashboard.repository', () => ({
  getTodayServicesByUser: jest.fn(async (userId, start, end) =>
    mockState.services
      .filter(
        (item) =>
          Number(item.user_id) === Number(userId) &&
          !item.deleted_at &&
          new Date(item.start_at) >= new Date(start) &&
          new Date(item.start_at) < new Date(end)
      )
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  ),
  countOperationalPendingByUser: jest.fn(async (userId, nowDate) =>
    mockState.services.filter(
      (item) =>
        Number(item.user_id) === Number(userId) &&
        !item.deleted_at &&
        new Date(item.start_at) < new Date(nowDate) &&
        !['REALIZADO', 'FALTOU', 'CANCELADO', 'NAO_CONVERTIDO'].includes(item.operational_status)
    ).length
  ),
  countFinancialPendingByUser: jest.fn(async (userId, dayStart) =>
    mockState.services.filter(
      (item) =>
        Number(item.user_id) === Number(userId) &&
        !item.deleted_at &&
        item.operational_status === 'REALIZADO' &&
        ['PREVISTO', 'NAO_PAGO'].includes(item.financial_status) &&
        item.payment_due_date &&
        new Date(item.payment_due_date) < mockStartOfDay(dayStart)
    ).length
  ),
  getMonthlyHoursByUser: jest.fn(async (userId) => {
    const now = new Date();
    const services = mockState.services.filter((item) => {
      const dt = new Date(item.start_at);
      return (
        Number(item.user_id) === Number(userId) &&
        !item.deleted_at &&
        dt.getUTCFullYear() === now.getUTCFullYear() &&
        dt.getUTCMonth() === now.getUTCMonth()
      );
    });

    let waiting = 0;
    let confirmed = 0;

    for (const service of services) {
      if (service.operational_status === 'RESERVA') {
        waiting += Number(service.duration_hours || 0);
      } else {
        confirmed += Number(service.duration_hours || 0);
      }
    }

    return { waiting_hours: waiting, confirmed_hours: confirmed };
  }),
}));

const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

describe('Alerts and Dashboard Integration', () => {
  beforeEach(() => {
    mockState.alerts = [];
    mockState.services = [];
    mockState.nextAlertId = 1;
    jest.clearAllMocks();
  });

  test('listar alertas do proprio usuario', async () => {
    mockState.services.push({
      id: 1,
      user_id: 10,
      service_type_id: 2,
      service_type_key: 'ras_voluntary',
      service_type_name: 'RAS Voluntario',
      start_at: new Date().toISOString(),
      duration_hours: 8,
      operational_status: 'REALIZADO',
      financial_status: 'PAGO',
      deleted_at: null,
    });

    mockState.alerts.push(
      {
        id: 1,
        user_id: 10,
        alert_type: 'DAY',
        dedupe_key: 'u:10|t:DAY|s:1|r:2026-04-10',
        status: 'ACTIVE',
        related_service_id: 1,
        deleted_at: null,
      },
      {
        id: 2,
        user_id: 11,
        alert_type: 'DAY',
        dedupe_key: 'u:11|t:DAY|s:2|r:2026-04-10',
        status: 'ACTIVE',
        related_service_id: 2,
        deleted_at: null,
      }
    );

    const response = await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: 10, role: 'POLICE', email: 'u10@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(1);
  });

  test('impedir leitura de alerta de outro usuario', async () => {
    mockState.alerts.push({
      id: 1,
      user_id: 20,
      alert_type: 'DAY',
      dedupe_key: 'u:20|t:DAY|s:1|r:2026-04-10',
      status: 'ACTIVE',
      related_service_id: 1,
      deleted_at: null,
    });

    const response = await request(app)
      .post('/api/v1/alerts/1/read')
      .set('Authorization', authHeader({ id: 21, role: 'POLICE', email: 'u21@local' }));

    expect(response.status).toBe(404);
  });

  test('marcar alerta como lido', async () => {
    mockState.alerts.push({
      id: 1,
      user_id: 30,
      alert_type: 'DAY',
      dedupe_key: 'u:30|t:DAY|s:1|r:2026-04-10',
      status: 'ACTIVE',
      related_service_id: 1,
      deleted_at: null,
    });

    const response = await request(app)
      .post('/api/v1/alerts/1/read')
      .set('Authorization', authHeader({ id: 30, role: 'POLICE', email: 'u30@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('READ');
  });

  test('dispensar alerta', async () => {
    mockState.alerts.push({
      id: 1,
      user_id: 31,
      alert_type: 'DAY',
      dedupe_key: 'u:31|t:DAY|s:1|r:2026-04-10',
      status: 'ACTIVE',
      related_service_id: 1,
      deleted_at: null,
    });

    const response = await request(app)
      .post('/api/v1/alerts/1/dismiss')
      .set('Authorization', authHeader({ id: 31, role: 'POLICE', email: 'u31@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('DISMISSED');
  });

  test('gerar alerta DAY sem duplicar', async () => {
    mockState.services.push({
      id: 100,
      user_id: 40,
      service_type_id: 2,
      service_type_key: 'ras_voluntary',
      service_type_name: 'RAS Voluntario',
      start_at: new Date().toISOString(),
      duration_hours: 12,
      operational_status: 'TITULAR',
      financial_status: 'PREVISTO',
      deleted_at: null,
    });

    await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: 40, role: 'POLICE', email: 'u40@local' }));

    await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: 40, role: 'POLICE', email: 'u40@local' }));

    const dayAlerts = mockState.alerts.filter((item) => item.user_id === 40 && item.alert_type === 'DAY');
    expect(dayAlerts).toHaveLength(1);
  });

  test('gerar alerta OPERATIONAL', async () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    mockState.services.push({
      id: 101,
      user_id: 41,
      service_type_id: 2,
      service_type_key: 'ras_voluntary',
      service_type_name: 'RAS Voluntario',
      start_at: past,
      duration_hours: 12,
      operational_status: 'TITULAR',
      financial_status: 'PREVISTO',
      deleted_at: null,
    });

    const response = await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: 41, role: 'POLICE', email: 'u41@local' }));

    expect(response.status).toBe(200);
    expect(mockState.alerts.some((item) => item.user_id === 41 && item.alert_type === 'OPERATIONAL')).toBe(true);
  });

  test('gerar alerta FINANCIAL', async () => {
    const due = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    mockState.services.push({
      id: 102,
      user_id: 42,
      service_type_id: 2,
      service_type_key: 'ras_voluntary',
      service_type_name: 'RAS Voluntario',
      start_at: past,
      duration_hours: 12,
      operational_status: 'REALIZADO',
      financial_status: 'PREVISTO',
      payment_due_date: due,
      deleted_at: null,
    });

    const response = await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: 42, role: 'POLICE', email: 'u42@local' }));

    expect(response.status).toBe(200);
    expect(mockState.alerts.some((item) => item.user_id === 42 && item.alert_type === 'FINANCIAL')).toBe(true);
  });

  test('dashboard summary com reservas separadas de confirmados', async () => {
    const now = new Date().toISOString();

    mockState.services.push(
      {
        id: 103,
        user_id: 50,
        service_type_id: 2,
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        start_at: now,
        duration_hours: 8,
        operational_status: 'RESERVA',
        financial_status: 'PREVISTO',
        deleted_at: null,
      },
      {
        id: 104,
        user_id: 50,
        service_type_id: 2,
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        start_at: now,
        duration_hours: 12,
        operational_status: 'TITULAR',
        financial_status: 'PREVISTO',
        deleted_at: null,
      }
    );

    const response = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', authHeader({ id: 50, role: 'POLICE', email: 'u50@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.today.reservations).toHaveLength(1);
    expect(response.body.data.today.confirmed).toHaveLength(1);
    expect(response.body.data.counts.operational_pending).toBeGreaterThanOrEqual(0);
    expect(response.body.data.hours.waiting).toBeGreaterThanOrEqual(8);
    expect(response.body.data.hours.confirmed).toBeGreaterThanOrEqual(12);
  });

  test('alerts ativos obsoletos sao removidos logicamente', async () => {
    mockState.alerts.push({
      id: 1,
      user_id: 60,
      alert_type: 'DAY',
      dedupe_key: 'u:60|t:DAY|s:999|r:2026-04-10',
      status: 'ACTIVE',
      related_service_id: 999,
      deleted_at: null,
    });

    const response = await request(app)
      .get('/api/v1/alerts')
      .set('Authorization', authHeader({ id: 60, role: 'POLICE', email: 'u60@local' }));

    expect(response.status).toBe(200);
    const old = mockState.alerts.find((item) => item.id === 1);
    expect(old.deleted_at).toBeTruthy();
  });
});
