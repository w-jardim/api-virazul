const request = require('supertest');
const jwt = require('jsonwebtoken');

const state = {
  nextServiceId: 1,
  services: [],
  ordinaryType: {
    id: 1,
    key: 'ordinary_shift',
    name: 'Escala Ordinaria',
    category: 'ORDINARY',
    counts_in_financial: 0,
    allows_reservation: 0,
  },
  rasType: {
    id: 2,
    key: 'ras_voluntary',
    name: 'RAS Voluntario',
    category: 'RAS',
    counts_in_financial: 1,
    allows_reservation: 1,
  },
};

function mockAddHours(dateValue, hours) {
  const start = new Date(dateValue);
  return new Date(start.getTime() + Number(hours) * 60 * 60 * 1000);
}

function mockIntersects(item, startAt, endAt) {
  const itemStart = new Date(item.start_at);
  const itemEnd = mockAddHours(item.start_at, item.duration_hours);
  return itemStart < new Date(endAt) && itemEnd > new Date(startAt);
}

jest.mock('../../src/modules/schedules/schedules.repository', () => {
  const connection = {
    beginTransaction: jest.fn(async () => undefined),
    commit: jest.fn(async () => undefined),
    rollback: jest.fn(async () => undefined),
    release: jest.fn(() => undefined),
    query: jest.fn(async (sql, params) => {
      const record = {
        id: state.nextServiceId++,
        user_id: params[0],
        service_type_id: params[1],
        start_at: params[2],
        duration_hours: params[3],
        operational_status: params[4],
        notes: params[6],
        financial_status: params[7],
        amount_total: params[15],
        is_complementary: params[18],
        deleted_at: null,
      };
      state.services.push(record);
      return [{ insertId: record.id }];
    }),
  };

  return {
    findOrdinaryServiceType: jest.fn(async () => state.ordinaryType),
    findOverlaps: jest.fn(async ({ userId, startAt, endAt }) =>
      state.services.filter(
        (item) =>
          Number(item.user_id) === Number(userId) &&
          !item.deleted_at &&
          mockIntersects(item, startAt, endAt)
      )
    ),
    getConnection: jest.fn(async () => connection),
    createService: jest.fn(async (conn, payload) => {
      const row = {
        id: state.nextServiceId++,
        ...payload,
        deleted_at: null,
      };
      state.services.push(row);
      return row.id;
    }),
    findByIds: jest.fn(async (ids) =>
      state.services
        .filter((item) => ids.includes(item.id))
        .map((item) => ({
          ...item,
          service_type_key:
            Number(item.service_type_id) === Number(state.ordinaryType.id)
              ? state.ordinaryType.key
              : state.rasType.key,
          service_type_name:
            Number(item.service_type_id) === Number(state.ordinaryType.id)
              ? state.ordinaryType.name
              : state.rasType.name,
        }))
        .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
    ),
  };
});

jest.mock('../../src/modules/agenda/agenda.repository', () => ({
  listByUserInRange: jest.fn(async (userId, startAt, endAt) =>
    state.services
      .filter(
        (item) =>
          Number(item.user_id) === Number(userId) &&
          !item.deleted_at &&
          new Date(item.start_at) >= new Date(startAt) &&
          new Date(item.start_at) < new Date(endAt)
      )
      .map((item) => ({
        ...item,
        service_type_key:
          Number(item.service_type_id) === Number(state.ordinaryType.id)
            ? state.ordinaryType.key
            : state.rasType.key,
        service_type_name:
          Number(item.service_type_id) === Number(state.ordinaryType.id)
            ? state.ordinaryType.name
            : state.rasType.name,
      }))
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  ),
}));

jest.mock('../../src/modules/services/services.repository', () => ({
  findServiceTypeById: jest.fn(async (id) => {
    if (Number(id) === 1) {
      return state.ordinaryType;
    }
    if (Number(id) === 2) {
      return state.rasType;
    }
    return null;
  }),
  getUserPreferenceRuleB: jest.fn(async () => false),
  createService: jest.fn(async (payload) => {
    const row = {
      id: state.nextServiceId++,
      ...payload,
      deleted_at: null,
    };
    state.services.push(row);
    return row;
  }),
  list: jest.fn(async () => []),
  findById: jest.fn(async () => null),
  updateService: jest.fn(async () => null),
  softDelete: jest.fn(async () => true),
  getConnection: jest.fn(async () => null),
  findByIdForUpdate: jest.fn(async () => null),
  applyTransition: jest.fn(async () => undefined),
  createStatusHistory: jest.fn(async () => undefined),
  findOverlaps: jest.fn(async ({ userId, startAt, endAt }) =>
    state.services.filter(
      (item) =>
        Number(item.user_id) === Number(userId) &&
        !item.deleted_at &&
        mockIntersects(item, startAt, endAt)
    )
  ),
}));

const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

describe('Schedules and Agenda Integration', () => {
  beforeEach(() => {
    state.nextServiceId = 1;
    state.services = [];
    jest.clearAllMocks();
  });

  test('criar escala simples', async () => {
    const response = await request(app)
      .post('/api/v1/schedules')
      .set('Authorization', authHeader({ id: 101, role: 'POLICE', email: 'u@local' }))
      .send({
        start_at: '2026-04-13T08:00:00.000Z',
        duration_hours: 12,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.created_count).toBe(1);
    expect(response.body.data.items[0].service_type_key).toBe('ordinary_shift');
  });

  test('criar escala recorrente', async () => {
    const response = await request(app)
      .post('/api/v1/schedules')
      .set('Authorization', authHeader({ id: 102, role: 'POLICE', email: 'u@local' }))
      .send({
        start_at: '2026-04-13T08:00:00.000Z',
        duration_hours: 12,
        recurrence: {
          weekdays: [1, 3, 5],
          period_days: 7,
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.created_count).toBeGreaterThanOrEqual(3);
  });

  test('listar agenda do dia com confirmados e reservas', async () => {
    state.services.push(
      {
        id: state.nextServiceId++,
        user_id: 103,
        service_type_id: 1,
        start_at: '2026-04-15T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'TITULAR',
        financial_status: 'PREVISTO',
        deleted_at: null,
      },
      {
        id: state.nextServiceId++,
        user_id: 103,
        service_type_id: 2,
        start_at: '2026-04-15T14:00:00.000Z',
        duration_hours: 6,
        operational_status: 'RESERVA',
        financial_status: 'PREVISTO',
        deleted_at: null,
      }
    );

    const response = await request(app)
      .get('/api/v1/agenda/day?date=2026-04-15')
      .set('Authorization', authHeader({ id: 103, role: 'POLICE', email: 'u@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.confirmed).toHaveLength(1);
    expect(response.body.data.reservations).toHaveLength(1);
  });

  test('listar agenda da semana', async () => {
    state.services.push({
      id: state.nextServiceId++,
      user_id: 104,
      service_type_id: 1,
      start_at: '2026-04-14T08:00:00.000Z',
      duration_hours: 12,
      operational_status: 'TITULAR',
      financial_status: 'PREVISTO',
      deleted_at: null,
    });

    const response = await request(app)
      .get('/api/v1/agenda/week?start=2026-04-13')
      .set('Authorization', authHeader({ id: 104, role: 'POLICE', email: 'u@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.days).toHaveLength(7);
  });

  test('listar agenda do mes', async () => {
    state.services.push({
      id: state.nextServiceId++,
      user_id: 105,
      service_type_id: 1,
      start_at: '2026-04-20T08:00:00.000Z',
      duration_hours: 12,
      operational_status: 'TITULAR',
      financial_status: 'PREVISTO',
      deleted_at: null,
    });

    const response = await request(app)
      .get('/api/v1/agenda/month?month=2026-04')
      .set('Authorization', authHeader({ id: 105, role: 'POLICE', email: 'u@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.month).toBe('2026-04');
    expect(response.body.data.days.length).toBeGreaterThan(0);
  });

  test('detectar e bloquear conflito sem force', async () => {
    state.services.push({
      id: state.nextServiceId++,
      user_id: 106,
      service_type_id: 1,
      start_at: '2026-04-21T08:00:00.000Z',
      duration_hours: 12,
      operational_status: 'TITULAR',
      financial_status: 'PREVISTO',
      deleted_at: null,
    });

    const response = await request(app)
      .post('/api/v1/schedules')
      .set('Authorization', authHeader({ id: 106, role: 'POLICE', email: 'u@local' }))
      .send({
        start_at: '2026-04-21T10:00:00.000Z',
        duration_hours: 8,
      });

    expect(response.status).toBe(409);
    expect(response.body.errors[0].code).toBe('SCHEDULE_CONFLICT');
  });

  test('permitir conflito com force', async () => {
    state.services.push({
      id: state.nextServiceId++,
      user_id: 107,
      service_type_id: 1,
      start_at: '2026-04-22T08:00:00.000Z',
      duration_hours: 12,
      operational_status: 'TITULAR',
      financial_status: 'PREVISTO',
      deleted_at: null,
    });

    const response = await request(app)
      .post('/api/v1/schedules')
      .set('Authorization', authHeader({ id: 107, role: 'POLICE', email: 'u@local' }))
      .send({
        start_at: '2026-04-22T10:00:00.000Z',
        duration_hours: 8,
        force: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.created_count).toBe(1);
  });

  test('validar integracao com services existentes (conflito no POST /services)', async () => {
    state.services.push({
      id: state.nextServiceId++,
      user_id: 108,
      service_type_id: 1,
      start_at: '2026-04-23T08:00:00.000Z',
      duration_hours: 12,
      operational_status: 'TITULAR',
      financial_status: 'PREVISTO',
      deleted_at: null,
    });

    const response = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: 108, role: 'POLICE', email: 'u@local' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-23T09:00:00.000Z',
        duration_hours: 6,
        operational_status: 'TITULAR',
        financial_status: 'PREVISTO',
        amount_base: 100,
      });

    expect(response.status).toBe(409);
    expect(response.body.errors[0].code).toBe('SCHEDULE_CONFLICT');
  });
});
