const request = require('supertest');
const jwt = require('jsonwebtoken');

const state = {
  nextServiceId: 1,
  services: [],
  history: [],
  serviceTypes: {
    2: { id: 2, key: 'ras_voluntary', allows_reservation: 1, counts_in_financial: 1 },
    3: { id: 3, key: 'ras_compulsory', allows_reservation: 0, counts_in_financial: 1 },
  },
  userRuleB: {},
};

const mockConnection = {
  beginTransaction: jest.fn(async () => undefined),
  commit: jest.fn(async () => undefined),
  rollback: jest.fn(async () => undefined),
  release: jest.fn(() => undefined),
};

jest.mock('../../src/modules/services/services.repository', () => ({
  findServiceTypeById: jest.fn(async (id) => state.serviceTypes[id] || null),
  getUserPreferenceRuleB: jest.fn(async (userId) => Boolean(state.userRuleB[userId])),
  createService: jest.fn(async (payload) => {
    const service = {
      id: state.nextServiceId++,
      version: 1,
      deleted_at: null,
      ...payload,
    };
    state.services.push(service);
    return { ...service };
  }),
  list: jest.fn(async (filters) =>
    state.services.filter((item) => {
      if (item.deleted_at) {
        return false;
      }
      if (filters.userId && Number(item.user_id) !== Number(filters.userId)) {
        return false;
      }
      if (filters.serviceTypeId && Number(item.service_type_id) !== Number(filters.serviceTypeId)) {
        return false;
      }
      return true;
    })
  ),
  findById: jest.fn(async (id) => {
    const row = state.services.find((item) => Number(item.id) === Number(id));
    return row ? { ...row } : null;
  }),
  updateService: jest.fn(async (id, payload) => {
    const index = state.services.findIndex((item) => Number(item.id) === Number(id));
    if (index < 0) {
      return null;
    }
    state.services[index] = {
      ...state.services[index],
      ...payload,
      version: Number(state.services[index].version || 1) + 1,
    };
    return { ...state.services[index] };
  }),
  softDelete: jest.fn(async (id) => {
    const index = state.services.findIndex((item) => Number(item.id) === Number(id) && !item.deleted_at);
    if (index < 0) {
      return false;
    }
    state.services[index] = {
      ...state.services[index],
      deleted_at: new Date().toISOString(),
      version: Number(state.services[index].version || 1) + 1,
    };
    return true;
  }),
  getConnection: jest.fn(async () => mockConnection),
  findByIdForUpdate: jest.fn(async (conn, id) => {
    const row = state.services.find((item) => Number(item.id) === Number(id) && !item.deleted_at);
    return row ? { ...row } : null;
  }),
  applyTransition: jest.fn(async (conn, id, transition) => {
    const index = state.services.findIndex((item) => Number(item.id) === Number(id));
    if (index >= 0) {
      state.services[index] = {
        ...state.services[index],
        operational_status: transition.operational_status,
        financial_status: transition.financial_status,
        performed_at: transition.performed_at,
        payment_at: transition.payment_at,
        amount_paid: transition.amount_paid,
        amount_balance: transition.amount_balance,
        version: Number(state.services[index].version || 1) + 1,
      };
    }
  }),
  createStatusHistory: jest.fn(async (conn, payload) => {
    state.history.push({ id: state.history.length + 1, ...payload });
  }),
}));

const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

function createUser(userId, ruleBEnabled) {
  state.userRuleB[userId] = Boolean(ruleBEnabled);
  return userId;
}

describe('Services Persistence Integration', () => {
  beforeEach(() => {
    state.nextServiceId = 1;
    state.services = [];
    state.history = [];
    state.userRuleB = {};
    jest.clearAllMocks();
  });

  test('persistencia do historico de transicao', async () => {
    const userA = createUser(1001, false);

    const createResponse = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@x.local' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'RESERVA',
        financial_status: 'PREVISTO',
        amount_base: 100,
      });

    expect(createResponse.status).toBe(201);

    const serviceId = createResponse.body.data.id;

    const transitionResponse = await request(app)
      .post(`/api/v1/services/${serviceId}/transition`)
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@x.local' }))
      .send({
        transition_type: 'CONVERSAO_RESERVA',
        target_operational_status: 'CONVERTIDO_TITULAR',
        reason: 'Convocado para titular',
      });

    expect(transitionResponse.status).toBe(200);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].previous_operational_status).toBe('RESERVA');
    expect(state.history[0].new_operational_status).toBe('CONVERTIDO_TITULAR');
  });

  test('soft delete persistido', async () => {
    const userA = createUser(1002, false);

    const createResponse = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@x.local' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'AGENDADO',
        financial_status: 'PREVISTO',
        amount_base: 100,
      });

    const serviceId = createResponse.body.data.id;

    const deleteResponse = await request(app)
      .delete(`/api/v1/services/${serviceId}`)
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@x.local' }));

    expect(deleteResponse.status).toBe(204);
    const row = state.services.find((item) => Number(item.id) === Number(serviceId));
    expect(row.deleted_at).toBeTruthy();
  });

  test('bloqueio de acesso entre usuario A e B', async () => {
    const userA = createUser(1003, false);
    const userB = createUser(1004, false);

    const createResponse = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@x.local' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'AGENDADO',
        financial_status: 'PREVISTO',
        amount_base: 100,
      });

    const serviceId = createResponse.body.data.id;

    const response = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set('Authorization', authHeader({ id: userB, role: 'POLICE', email: 'b@x.local' }));

    expect(response.status).toBe(403);
  });

  test('bloqueio RAS_COMPULSORY com RESERVA e RESERVA->REALIZADO', async () => {
    const userA = createUser(1005, false);

    const invalidCreate = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@x.local' }))
      .send({
        service_type_id: 3,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'RESERVA',
        financial_status: 'PREVISTO',
        amount_base: 100,
      });

    expect(invalidCreate.status).toBe(400);

    const reserveCreate = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@x.local' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'RESERVA',
        financial_status: 'PREVISTO',
        amount_base: 100,
      });

    const serviceId = reserveCreate.body.data.id;

    const invalidTransition = await request(app)
      .post(`/api/v1/services/${serviceId}/transition`)
      .set('Authorization', authHeader({ id: userA, role: 'POLICE', email: 'a@x.local' }))
      .send({
        transition_type: 'MANUAL',
        target_operational_status: 'REALIZADO',
      });

    expect(invalidTransition.status).toBe(400);
  });

  test('validacoes financeiras de borda e Regra B com persistencia', async () => {
    const userRuleBOn = createUser(1006, true);
    const userRuleBOff = createUser(1007, false);

    const invalidAmounts = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: userRuleBOn, role: 'POLICE', email: 'on@x.local' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'AGENDADO',
        financial_status: 'PREVISTO',
        amount_base: 100,
        amount_paid: 120,
      });

    expect(invalidAmounts.status).toBe(400);

    const reservePaidPartial = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: userRuleBOn, role: 'POLICE', email: 'on@x.local' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'RESERVA',
        financial_status: 'PAGO_PARCIAL',
        amount_base: 100,
        amount_paid: 50,
      });

    expect(reservePaidPartial.status).toBe(400);

    const createOn = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: userRuleBOn, role: 'POLICE', email: 'on@x.local' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'TITULAR',
        financial_status: 'PREVISTO',
        amount_base: 150,
      });

    const onServiceId = createOn.body.data.id;

    const transitionOn = await request(app)
      .post(`/api/v1/services/${onServiceId}/transition`)
      .set('Authorization', authHeader({ id: userRuleBOn, role: 'POLICE', email: 'on@x.local' }))
      .send({
        transition_type: 'REALIZACAO',
        target_operational_status: 'REALIZADO',
      });

    expect(transitionOn.status).toBe(200);
    expect(transitionOn.body.data.financial_status).toBe('PAGO');
    expect(Number(transitionOn.body.data.amount_paid)).toBe(Number(transitionOn.body.data.amount_total));
    expect(Number(transitionOn.body.data.amount_balance)).toBe(0);
    expect(transitionOn.body.data.payment_at).toBeTruthy();

    const createOff = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: userRuleBOff, role: 'POLICE', email: 'off@x.local' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'TITULAR',
        financial_status: 'PREVISTO',
        amount_base: 150,
      });

    const offServiceId = createOff.body.data.id;

    const transitionOff = await request(app)
      .post(`/api/v1/services/${offServiceId}/transition`)
      .set('Authorization', authHeader({ id: userRuleBOff, role: 'POLICE', email: 'off@x.local' }))
      .send({
        transition_type: 'REALIZACAO',
        target_operational_status: 'REALIZADO',
      });

    expect(transitionOff.status).toBe(200);
    expect(transitionOff.body.data.financial_status).toBe('PREVISTO');
  });
});
