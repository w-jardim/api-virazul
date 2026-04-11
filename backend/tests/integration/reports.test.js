const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockState = {
  operationalServices: [],
  financialServices: [],
  reservationTransitions: [],
};

function mockInRange(dateValue, start, end) {
  const date = new Date(dateValue);
  if (start && date < new Date(start)) {
    return false;
  }
  if (end && date >= new Date(end)) {
    return false;
  }
  return true;
}

jest.mock('../../src/modules/reports/reports.repository', () => ({
  listOperationalServices: jest.fn(async (userId, filters = {}) =>
    mockState.operationalServices
      .filter((item) => Number(item.user_id) === Number(userId))
      .filter((item) => mockInRange(item.start_at, filters.startAt, filters.endAt))
      .filter((item) => (filters.serviceType ? item.service_type_key === filters.serviceType : true))
      .filter((item) => (filters.operationalStatus ? item.operational_status === filters.operationalStatus : true))
  ),
  listReservationTransitions: jest.fn(async (userId, filters = {}) =>
    mockState.reservationTransitions
      .filter((item) => Number(item.user_id) === Number(userId))
      .filter((item) => mockInRange(item.start_at, filters.startAt, filters.endAt))
      .filter((item) => (filters.serviceType ? item.service_type_key === filters.serviceType : true))
  ),
  listFinancialServices: jest.fn(async (userId, filters = {}) =>
    mockState.financialServices
      .filter((item) => Number(item.user_id) === Number(userId))
      .filter((item) => mockInRange(item.start_at, filters.startAt, filters.endAt))
      .filter((item) => (filters.serviceType ? item.service_type_key === filters.serviceType : true))
      .filter((item) => (filters.financialStatus ? item.financial_status === filters.financialStatus : true))
  ),
}));

const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

describe('Reports Integration', () => {
  beforeEach(() => {
    mockState.operationalServices = [];
    mockState.financialServices = [];
    mockState.reservationTransitions = [];
    jest.clearAllMocks();
  });

  test('relatorio operacional responde 200 e calcula metricas', async () => {
    mockState.operationalServices = [
      { id: 1, user_id: 10, start_at: '2026-05-01T10:00:00.000Z', duration_hours: 12, operational_status: 'TITULAR', service_type_key: 'ras_voluntary' },
      { id: 2, user_id: 10, start_at: '2026-05-02T10:00:00.000Z', duration_hours: 8, operational_status: 'RESERVA', service_type_key: 'ras_voluntary' },
      { id: 3, user_id: 10, start_at: '2026-05-03T10:00:00.000Z', duration_hours: 6, operational_status: 'REALIZADO', service_type_key: 'proeis' },
      { id: 4, user_id: 99, start_at: '2026-05-03T10:00:00.000Z', duration_hours: 24, operational_status: 'REALIZADO', service_type_key: 'proeis' },
    ];
    mockState.reservationTransitions = [
      { service_id: 1, user_id: 10, start_at: '2026-05-01T10:00:00.000Z', service_type_key: 'ras_voluntary', new_operational_status: 'CONVERTIDO_TITULAR' },
      { service_id: 2, user_id: 10, start_at: '2026-05-04T10:00:00.000Z', service_type_key: 'ras_voluntary', new_operational_status: 'NAO_CONVERTIDO' },
    ];

    const response = await request(app)
      .get('/api/v1/reports/operational?start_date=2026-05-01&end_date=2026-05-31')
      .set('Authorization', authHeader({ id: 10, role: 'POLICE', email: 'u10@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.summary.total_services).toBe(3);
    expect(response.body.data.summary.confirmed_hours).toBe(18);
    expect(response.body.data.summary.waiting_hours).toBe(8);
    expect(response.body.data.summary.realized_hours).toBe(6);
    expect(response.body.data.reservation_metrics.total_reservations).toBe(3);
    expect(response.body.data.reservation_metrics.converted_reservations).toBe(1);
    expect(response.body.data.reservation_metrics.non_converted_reservations).toBe(1);
    expect(response.body.data.reservation_metrics.conversion_rate).toBeCloseTo(33.33, 2);
  });

  test('relatorio operacional filtros por status e tipo', async () => {
    mockState.operationalServices = [
      { id: 1, user_id: 20, start_at: '2026-05-01T10:00:00.000Z', duration_hours: 12, operational_status: 'REALIZADO', service_type_key: 'ras_voluntary' },
      { id: 2, user_id: 20, start_at: '2026-05-01T12:00:00.000Z', duration_hours: 8, operational_status: 'REALIZADO', service_type_key: 'proeis' },
    ];

    const response = await request(app)
      .get('/api/v1/reports/operational?service_type=proeis&operational_status=REALIZADO')
      .set('Authorization', authHeader({ id: 20, role: 'POLICE', email: 'u20@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.summary.total_services).toBe(1);
    expect(response.body.data.summary.realized_hours).toBe(8);
  });

  test('relatorio financeiro responde 200 com totais corretos e exclui ordinaria', async () => {
    mockState.financialServices = [
      {
        id: 1,
        user_id: 30,
        start_at: '2026-05-01T10:00:00.000Z',
        operational_status: 'REALIZADO',
        financial_status: 'PAGO',
        amount_total: 200,
        amount_paid: 200,
        amount_balance: 0,
        payment_due_date: '2026-05-10',
        service_type_key: 'ras_voluntary',
        service_type_category: 'RAS',
        counts_in_financial: 1,
      },
      {
        id: 2,
        user_id: 30,
        start_at: '2026-05-02T10:00:00.000Z',
        operational_status: 'TITULAR',
        financial_status: 'NAO_PAGO',
        amount_total: 120,
        amount_paid: 0,
        amount_balance: 120,
        payment_due_date: '2026-03-01',
        service_type_key: 'proeis',
        service_type_category: 'PROEIS',
        counts_in_financial: 1,
      },
      {
        id: 3,
        user_id: 30,
        start_at: '2026-05-03T10:00:00.000Z',
        operational_status: 'REALIZADO',
        financial_status: 'PAGO',
        amount_total: 500,
        amount_paid: 500,
        amount_balance: 0,
        payment_due_date: '2026-05-10',
        service_type_key: 'ordinary_shift',
        service_type_category: 'ORDINARY',
        counts_in_financial: 1,
      },
    ];

    const response = await request(app)
      .get('/api/v1/reports/financial?start_date=2026-05-01&end_date=2026-05-31')
      .set('Authorization', authHeader({ id: 30, role: 'POLICE', email: 'u30@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.summary.total_expected).toBe(320);
    expect(response.body.data.summary.total_received).toBe(200);
    expect(response.body.data.summary.total_pending).toBe(120);
    expect(response.body.data.summary.total_overdue).toBe(120);
    expect(response.body.data.by_service_type.ordinary_shift).toBe(0);
    expect(response.body.data.by_service_type.ras_compulsory).toBe(0);
    expect(response.body.data.by_service_type.other).toBe(0);
    expect(response.body.data.summary.top_service_type).toBe('ras_voluntary');
  });

  test('relatorio financeiro filtros por status e tipo funcionando', async () => {
    mockState.financialServices = [
      {
        id: 1,
        user_id: 40,
        start_at: '2026-05-01T10:00:00.000Z',
        operational_status: 'REALIZADO',
        financial_status: 'PAGO',
        amount_total: 220,
        amount_paid: 220,
        amount_balance: 0,
        payment_due_date: '2026-05-10',
        service_type_key: 'ras_voluntary',
        service_type_category: 'RAS',
        counts_in_financial: 1,
      },
      {
        id: 2,
        user_id: 40,
        start_at: '2026-05-02T10:00:00.000Z',
        operational_status: 'REALIZADO',
        financial_status: 'NAO_PAGO',
        amount_total: 90,
        amount_paid: 0,
        amount_balance: 90,
        payment_due_date: '2026-05-11',
        service_type_key: 'proeis',
        service_type_category: 'PROEIS',
        counts_in_financial: 1,
      },
    ];

    const response = await request(app)
      .get('/api/v1/reports/financial?service_type=proeis&financial_status=NAO_PAGO')
      .set('Authorization', authHeader({ id: 40, role: 'POLICE', email: 'u40@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.summary.total_expected).toBe(90);
    expect(response.body.data.by_financial_status.NAO_PAGO).toBe(90);
  });

  test('isolamento por usuario', async () => {
    mockState.operationalServices = [
      { id: 1, user_id: 50, start_at: '2026-05-01T10:00:00.000Z', duration_hours: 12, operational_status: 'TITULAR', service_type_key: 'ras_voluntary' },
      { id: 2, user_id: 60, start_at: '2026-05-01T10:00:00.000Z', duration_hours: 12, operational_status: 'TITULAR', service_type_key: 'ras_voluntary' },
    ];

    const response = await request(app)
      .get('/api/v1/reports/operational')
      .set('Authorization', authHeader({ id: 50, role: 'POLICE', email: 'u50@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.summary.total_services).toBe(1);
  });

  test('reservation_metrics segue o mesmo recorte com filtro operacional_status', async () => {
    mockState.operationalServices = [
      {
        id: 101,
        user_id: 70,
        start_at: '2026-05-01T10:00:00.000Z',
        duration_hours: 8,
        operational_status: 'RESERVA',
        service_type_key: 'ras_voluntary',
      },
    ];
    mockState.reservationTransitions = [
      {
        service_id: 999,
        user_id: 70,
        start_at: '2026-05-01T10:00:00.000Z',
        service_type_key: 'ras_voluntary',
        new_operational_status: 'CONVERTIDO_TITULAR',
      },
    ];

    const response = await request(app)
      .get('/api/v1/reports/operational?operational_status=RESERVA')
      .set('Authorization', authHeader({ id: 70, role: 'POLICE', email: 'u70@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.reservation_metrics.total_reservations).toBe(1);
    expect(response.body.data.reservation_metrics.converted_reservations).toBe(0);
  });
});
