const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/modules/services/services.repository', () => ({
  findServiceTypeById: jest.fn(),
  getUserPreferenceRuleB: jest.fn(),
  createService: jest.fn(),
  list: jest.fn(),
  findById: jest.fn(),
  updateService: jest.fn(),
  softDelete: jest.fn(),
  getConnection: jest.fn(),
  findByIdForUpdate: jest.fn(),
  applyTransition: jest.fn(),
  createStatusHistory: jest.fn(),
  findOverlaps: jest.fn(),
}));

const repository = require('../../src/modules/services/services.repository');
const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

function makeBaseService(overrides = {}) {
  return {
    id: 101,
    user_id: 2,
    service_type_id: 2,
    start_at: '2026-04-10T08:00:00.000Z',
    duration_hours: 12,
    operational_status: 'RESERVA',
    financial_status: 'PREVISTO',
    amount_base: 100,
    amount_paid: 0,
    amount_balance: 100,
    amount_meal: 0,
    amount_transport: 0,
    amount_additional: 0,
    amount_discount: 0,
    amount_total: 100,
    performed_at: null,
    payment_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe('Services Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findOverlaps.mockResolvedValue([]);
  });

  test('criar servico valido', async () => {
    repository.findServiceTypeById.mockResolvedValue({
      id: 2,
      key: 'ras_voluntary',
      allows_reservation: 1,
      counts_in_financial: 1,
    });

    repository.createService.mockImplementation(async (payload) => ({
      id: 999,
      ...payload,
      deleted_at: null,
    }));

    const response = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'AGENDADO',
        financial_status: 'PREVISTO',
        amount_base: 120,
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty('id', 999);
  });

  test('validar params id invalido retorna 400', async () => {
    const response = await request(app)
      .get('/api/v1/services/abc')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }));

    expect(response.status).toBe(400);
    expect(response.body.errors[0].code).toBe('VALIDATION_ERROR');
  });

  test('validar query invalida retorna 400', async () => {
    const response = await request(app)
      .get('/api/v1/services?user_id=foo')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }));

    expect(response.status).toBe(400);
    expect(response.body.errors[0].code).toBe('VALIDATION_ERROR');
  });

  test('impedir compulsorio com reserva', async () => {
    repository.findServiceTypeById.mockResolvedValue({
      id: 3,
      key: 'ras_compulsory',
      allows_reservation: 0,
      counts_in_financial: 1,
    });

    const response = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        service_type_id: 3,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'RESERVA',
        financial_status: 'PREVISTO',
        amount_base: 120,
      });

    expect(response.status).toBe(400);
  });

  test('impedir amount_total negativo', async () => {
    repository.findServiceTypeById.mockResolvedValue({
      id: 2,
      key: 'ras_voluntary',
      allows_reservation: 1,
      counts_in_financial: 1,
    });

    const response = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'AGENDADO',
        financial_status: 'PREVISTO',
        amount_base: 100,
        amount_discount: 200,
      });

    expect(response.status).toBe(400);
  });

  test('impedir amount_paid maior que amount_total', async () => {
    repository.findServiceTypeById.mockResolvedValue({
      id: 2,
      key: 'ras_voluntary',
      allows_reservation: 1,
      counts_in_financial: 1,
    });

    const response = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'AGENDADO',
        financial_status: 'PREVISTO',
        amount_base: 100,
        amount_paid: 120,
      });

    expect(response.status).toBe(400);
  });

  test('impedir RESERVA com PAGO_PARCIAL', async () => {
    repository.findServiceTypeById.mockResolvedValue({
      id: 2,
      key: 'ras_voluntary',
      allows_reservation: 1,
      counts_in_financial: 1,
    });

    const response = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'RESERVA',
        financial_status: 'PAGO_PARCIAL',
        amount_base: 100,
        amount_paid: 50,
      });

    expect(response.status).toBe(400);
  });

  test('bloquear acesso entre usuario A e B', async () => {
    repository.findById.mockResolvedValue(makeBaseService({ user_id: 99 }));

    const response = await request(app)
      .get('/api/v1/services/101')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }));

    expect(response.status).toBe(403);
  });

  test('impedir reserva virar realizado sem conversao', async () => {
    const existing = makeBaseService({ operational_status: 'RESERVA' });

    repository.findById.mockResolvedValue(existing);

    const response = await request(app)
      .post('/api/v1/services/101/transition')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        transition_type: 'MANUAL',
        target_operational_status: 'REALIZADO',
      });

    expect(response.status).toBe(400);
  });

  test('permitir conversao RESERVA -> CONVERTIDO_TITULAR', async () => {
    const state = { service: makeBaseService({ operational_status: 'RESERVA' }) };
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    repository.findById
      .mockResolvedValueOnce(state.service)
      .mockResolvedValueOnce({ ...state.service, operational_status: 'CONVERTIDO_TITULAR' });

    repository.getConnection.mockResolvedValue(connection);
    repository.findByIdForUpdate.mockResolvedValue(state.service);
    repository.applyTransition.mockImplementation(async (conn, id, transition) => {
      state.service = {
        ...state.service,
        operational_status: transition.operational_status,
        financial_status: transition.financial_status,
      };
    });
    repository.createStatusHistory.mockResolvedValue();

    const response = await request(app)
      .post('/api/v1/services/101/transition')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        transition_type: 'CONVERSAO_RESERVA',
        target_operational_status: 'CONVERTIDO_TITULAR',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.operational_status).toBe('CONVERTIDO_TITULAR');
  });

  test('permitir CONVERTIDO_TITULAR -> REALIZADO', async () => {
    const state = { service: makeBaseService({ operational_status: 'CONVERTIDO_TITULAR' }) };
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    repository.findById
      .mockResolvedValueOnce(state.service)
      .mockResolvedValueOnce({ ...state.service, operational_status: 'REALIZADO', financial_status: 'PREVISTO' });

    repository.getUserPreferenceRuleB.mockResolvedValue(false);
    repository.getConnection.mockResolvedValue(connection);
    repository.findByIdForUpdate.mockResolvedValue(state.service);
    repository.applyTransition.mockImplementation(async (conn, id, transition) => {
      state.service = {
        ...state.service,
        operational_status: transition.operational_status,
        financial_status: transition.financial_status,
      };
    });
    repository.createStatusHistory.mockResolvedValue();

    const response = await request(app)
      .post('/api/v1/services/101/transition')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        transition_type: 'REALIZACAO',
        target_operational_status: 'REALIZADO',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.operational_status).toBe('REALIZADO');
  });

  test('aplicar Regra B ativa', async () => {
    const state = { service: makeBaseService({ operational_status: 'TITULAR' }) };
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    repository.findById
      .mockResolvedValueOnce(state.service)
      .mockResolvedValueOnce({ ...state.service, operational_status: 'REALIZADO', financial_status: 'PAGO', amount_paid: 100, amount_balance: 0 });

    repository.getUserPreferenceRuleB.mockResolvedValue(true);
    repository.getConnection.mockResolvedValue(connection);
    repository.findByIdForUpdate.mockResolvedValue(state.service);
    repository.applyTransition.mockResolvedValue();
    repository.createStatusHistory.mockResolvedValue();

    const response = await request(app)
      .post('/api/v1/services/101/transition')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        transition_type: 'REALIZACAO',
        target_operational_status: 'REALIZADO',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.financial_status).toBe('PAGO');
  });

  test('aplicar Regra B desativada', async () => {
    const state = { service: makeBaseService({ operational_status: 'TITULAR' }) };
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    repository.findById
      .mockResolvedValueOnce(state.service)
      .mockResolvedValueOnce({ ...state.service, operational_status: 'REALIZADO', financial_status: 'PREVISTO' });

    repository.getUserPreferenceRuleB.mockResolvedValue(false);
    repository.getConnection.mockResolvedValue(connection);
    repository.findByIdForUpdate.mockResolvedValue(state.service);
    repository.applyTransition.mockResolvedValue();
    repository.createStatusHistory.mockResolvedValue();

    const response = await request(app)
      .post('/api/v1/services/101/transition')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        transition_type: 'REALIZACAO',
        target_operational_status: 'REALIZADO',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.financial_status).toBe('PREVISTO');
  });

  test('soft delete funcionar', async () => {
    repository.findById.mockResolvedValue(makeBaseService());
    repository.softDelete.mockResolvedValue(true);

    const response = await request(app)
      .delete('/api/v1/services/101')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }));

    expect(response.status).toBe(204);
    expect(repository.softDelete).toHaveBeenCalledWith(101);
  });

  test('historico ser criado apos transicao', async () => {
    const state = { service: makeBaseService({ operational_status: 'RESERVA' }) };
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    repository.findById
      .mockResolvedValueOnce(state.service)
      .mockResolvedValueOnce({ ...state.service, operational_status: 'CONVERTIDO_TITULAR' });

    repository.getConnection.mockResolvedValue(connection);
    repository.findByIdForUpdate.mockResolvedValue(state.service);
    repository.applyTransition.mockResolvedValue();
    repository.createStatusHistory.mockResolvedValue();

    const response = await request(app)
      .post('/api/v1/services/101/transition')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        transition_type: 'CONVERSAO_RESERVA',
        target_operational_status: 'CONVERTIDO_TITULAR',
        reason: 'Convocado para titular',
      });

    expect(response.status).toBe(200);
    expect(repository.createStatusHistory).toHaveBeenCalledTimes(1);
  });
});

