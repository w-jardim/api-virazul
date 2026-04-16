const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockState = {
  preferencesByUser: new Map(),
  monthlyByUser: new Map(),
  servicesByUser: new Map(),
};

jest.mock('../../src/modules/planning/planning.repository', () => ({
  getUserPreferences: jest.fn(async (userId) => mockState.preferencesByUser.get(Number(userId)) || null),
  getMonthlyHours: jest.fn(async (userId) => mockState.monthlyByUser.get(Number(userId)) || { confirmed_hours: 0, waiting_hours: 0 }),
  getServicesInRange: jest.fn(async (userId) => mockState.servicesByUser.get(Number(userId)) || []),
}));

const env = require('../../src/config/env');
const app = require('../../src/app');
const { toDateKeyInTimeZone } = require('../../src/modules/alerts/alerts.time');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

function getCurrentMonthDate(daysOffset = 0) {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysOffset, 12, 0, 0)
  ).toISOString();
}

describe('Planning Integration', () => {
  beforeEach(() => {
    mockState.preferencesByUser = new Map();
    mockState.monthlyByUser = new Map();
    mockState.servicesByUser = new Map();
    jest.clearAllMocks();
  });

  test('calculo de horas e projection com 6h, 8h, 12h e 24h', async () => {
    mockState.preferencesByUser.set(10, { monthly_hour_goal: 120, planning_preferences: {} });
    mockState.monthlyByUser.set(10, { confirmed_hours: 72, waiting_hours: 16 });

    const response = await request(app)
      .get('/api/v1/planning/summary')
      .set('Authorization', authHeader({ id: 10, role: 'POLICE', email: 'u10@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.goal).toBe(120);
    expect(response.body.data.confirmed_hours).toBe(72);
    expect(response.body.data.waiting_hours).toBe(16);
    expect(response.body.data.remaining_hours).toBe(48);
    expect(response.body.data.projection.by_duration).toMatchObject({
      '6': 8,
      '8': 6,
      '12': 4,
      '24': 2,
    });
    expect(response.body.data.projection.combinations.length).toBeGreaterThan(0);
    expect(response.body.data.projection.combinations.every((item) => item.total_hours <= 48)).toBe(true);
    expect(response.body.data.projection.combinations[0].pending_hours).toBe(0);
  });

  test('bloqueio sem token', async () => {
    const response = await request(app).get('/api/v1/planning/summary');
    expect(response.status).toBe(401);
  });

  test('comportamento sem preferencias e sem meta definida', async () => {
    mockState.preferencesByUser.set(20, { monthly_hour_goal: null, planning_preferences: null });
    mockState.monthlyByUser.set(20, { confirmed_hours: 10, waiting_hours: 0 });

    const response = await request(app)
      .get('/api/v1/planning/summary')
      .set('Authorization', authHeader({ id: 20, role: 'POLICE', email: 'u20@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.goal).toBe(120);
    expect(response.body.data.remaining_hours).toBe(110);
    expect(response.body.data.preferences.preferred_durations).toEqual([]);
  });

  test('comportamento com preferencias limita duracoes', async () => {
    mockState.preferencesByUser.set(30, {
      monthly_hour_goal: 100,
      planning_preferences: {
        preferred_durations: [8, 12],
        avoided_durations: [24],
        max_single_shift_hours: 12,
      },
    });
    mockState.monthlyByUser.set(30, { confirmed_hours: 76, waiting_hours: 8 });

    const response = await request(app)
      .get('/api/v1/planning/summary')
      .set('Authorization', authHeader({ id: 30, role: 'POLICE', email: 'u30@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.remaining_hours).toBe(24);
    expect(response.body.data.projection.by_duration['24']).toBe(0);
  });

  test('resposta coerente quando meta ja foi atingida', async () => {
    mockState.preferencesByUser.set(35, {
      monthly_hour_goal: 100,
      planning_preferences: {},
    });
    mockState.monthlyByUser.set(35, { confirmed_hours: 120, waiting_hours: 8 });

    const response = await request(app)
      .get('/api/v1/planning/summary')
      .set('Authorization', authHeader({ id: 35, role: 'POLICE', email: 'u35@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.remaining_hours).toBe(0);
    expect(response.body.data.projection.by_duration).toEqual({
      '6': 0,
      '8': 0,
      '12': 0,
      '24': 0,
    });
    expect(response.body.data.projection.combinations).toEqual([]);
  });

  test('combinações mostram pendência quando nenhuma duração cabe no restante', async () => {
    mockState.preferencesByUser.set(36, {
      monthly_hour_goal: 101,
      planning_preferences: {},
    });
    mockState.monthlyByUser.set(36, { confirmed_hours: 96, waiting_hours: 0 });

    const response = await request(app)
      .get('/api/v1/planning/summary')
      .set('Authorization', authHeader({ id: 36, role: 'POLICE', email: 'u36@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.remaining_hours).toBe(5);
    expect(response.body.data.projection.combinations).toEqual([
      {
        items: [],
        total_hours: 0,
        pending_hours: 5,
      },
    ]);
  });

  test('sugestoes respeitam preferencias configuradas', async () => {
    mockState.preferencesByUser.set(40, {
      monthly_hour_goal: 120,
      planning_preferences: {
        preferred_durations: [12],
        avoided_durations: [24],
        preferred_durations_on_days_off: [12],
        max_single_shift_hours: 12,
      },
    });
    mockState.monthlyByUser.set(40, { confirmed_hours: 96, waiting_hours: 0 });
    mockState.servicesByUser.set(40, [
      {
        id: 1,
        start_at: getCurrentMonthDate(0),
        duration_hours: 12,
        operational_status: 'TITULAR',
        service_category: 'ORDINARY',
        service_type_key: 'ordinary_shift',
      },
    ]);

    const response = await request(app)
      .get('/api/v1/planning/suggestions')
      .set('Authorization', authHeader({ id: 40, role: 'POLICE', email: 'u40@local' }));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].suggested_duration).toBe(12);
    expect(response.body.data[0].reason).toContain('prefer');
  });

  test('sugestoes em modo neutro funcionam sem planning_preferences', async () => {
    mockState.preferencesByUser.set(50, {
      monthly_hour_goal: 30,
      planning_preferences: null,
    });
    mockState.monthlyByUser.set(50, { confirmed_hours: 0, waiting_hours: 0 });
    mockState.servicesByUser.set(50, []);

    const response = await request(app)
      .get('/api/v1/planning/suggestions')
      .set('Authorization', authHeader({ id: 50, role: 'POLICE', email: 'u50@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect([6, 8, 12, 24]).toContain(response.body.data[0].suggested_duration);
  });

  test('sugestoes respeitam agenda real e conflitos', async () => {
    mockState.preferencesByUser.set(60, {
      monthly_hour_goal: 48,
      planning_preferences: { preferred_durations: [12] },
    });
    mockState.monthlyByUser.set(60, { confirmed_hours: 0, waiting_hours: 0 });
    mockState.servicesByUser.set(60, [
      {
        id: 10,
        start_at: getCurrentMonthDate(0),
        duration_hours: 12,
        operational_status: 'TITULAR',
        service_category: 'RAS',
        service_type_key: 'ras_voluntary',
      },
      {
        id: 11,
        start_at: getCurrentMonthDate(1),
        duration_hours: 12,
        operational_status: 'TITULAR',
        service_category: 'ORDINARY',
        service_type_key: 'ordinary_shift',
      },
    ]);

    const conflictDate = toDateKeyInTimeZone(getCurrentMonthDate(0));

    const response = await request(app)
      .get('/api/v1/planning/suggestions')
      .set('Authorization', authHeader({ id: 60, role: 'POLICE', email: 'u60@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data.some((item) => item.date === conflictDate)).toBe(false);
  });
});
