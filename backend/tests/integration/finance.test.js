const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockState = {
  services: [],
};

jest.mock('../../src/modules/finance/finance.repository', () => ({
  listServicesForFinance: jest.fn(async (userId, filters = {}) =>
    mockState.services
      .filter((item) => Number(item.user_id) === Number(userId))
      .filter((item) => !item.deleted_at)
      .filter((item) => (filters.startAt ? new Date(item.start_at) >= new Date(filters.startAt) : true))
      .filter((item) => (filters.endAt ? new Date(item.start_at) < new Date(filters.endAt) : true))
      .filter((item) => (filters.serviceType ? item.service_type_key === filters.serviceType : true))
      .filter((item) => (filters.financialStatus ? item.financial_status === filters.financialStatus : true))
  ),
}));

const env = require('../../src/config/env');
const app = require('../../src/app');
const { toDateKeyInTimeZone } = require('../../src/modules/alerts/alerts.time');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

function isoDate(monthDay, time = '10:00:00.000Z') {
  return `${monthDay}T${time}`;
}

describe('Finance Integration', () => {
  beforeEach(() => {
    mockState.services = [];
    jest.clearAllMocks();
  });

  test('resumo mensal correto + by_status + overdue', async () => {
    mockState.services = [
      {
        id: 1,
        user_id: 10,
        start_at: isoDate('2026-05-02'),
        duration_hours: 12,
        operational_status: 'REALIZADO',
        financial_status: 'PAGO',
        amount_total: 240,
        amount_paid: 240,
        amount_balance: 0,
        payment_due_date: '2026-05-20',
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        counts_in_financial: 1,
      },
      {
        id: 2,
        user_id: 10,
        start_at: isoDate('2026-05-03'),
        duration_hours: 8,
        operational_status: 'REALIZADO',
        financial_status: 'PAGO_PARCIAL',
        amount_total: 180,
        amount_paid: 100,
        amount_balance: 80,
        payment_due_date: '2026-05-22',
        service_type_key: 'proeis',
        service_type_name: 'PROEIS',
        counts_in_financial: 1,
      },
      {
        id: 3,
        user_id: 10,
        start_at: isoDate('2026-05-04'),
        duration_hours: 6,
        operational_status: 'TITULAR',
        financial_status: 'NAO_PAGO',
        amount_total: 120,
        amount_paid: 0,
        amount_balance: 120,
        payment_due_date: '2026-03-01',
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        counts_in_financial: 1,
      },
      {
        id: 4,
        user_id: 10,
        start_at: isoDate('2026-05-05'),
        duration_hours: 12,
        operational_status: 'RESERVA',
        financial_status: 'PREVISTO',
        amount_total: 300,
        amount_paid: 0,
        amount_balance: 300,
        payment_due_date: '2026-05-30',
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        counts_in_financial: 1,
      },
      {
        id: 5,
        user_id: 10,
        start_at: isoDate('2026-05-06'),
        duration_hours: 24,
        operational_status: 'TITULAR',
        financial_status: 'PAGO',
        amount_total: 0,
        amount_paid: 0,
        amount_balance: 0,
        payment_due_date: null,
        service_type_key: 'ordinary_shift',
        service_type_name: 'Escala Ordinaria',
        counts_in_financial: 0,
      },
    ];

    const response = await request(app)
      .get('/api/v1/finance/summary?month=2026-05')
      .set('Authorization', authHeader({ id: 10, role: 'POLICE', email: 'user@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.total_expected).toBe(540);
    expect(response.body.data.total_received).toBe(240);
    expect(response.body.data.total_pending).toBe(200);
    expect(response.body.data.total_overdue).toBe(120);
    expect(response.body.data.by_status.PAGO).toBe(240);
    expect(response.body.data.by_status.PAGO_PARCIAL).toBe(180);
    expect(response.body.data.by_status.NAO_PAGO).toBe(120);
    expect(response.body.data.by_status.PREVISTO).toBe(0);
  });

  test('summary bloqueia sem token', async () => {
    const response = await request(app).get('/api/v1/finance/summary?month=2026-05');
    expect(response.status).toBe(401);
  });

  test('report aplica filtros e agrupa por tipo', async () => {
    mockState.services = [
      {
        id: 11,
        user_id: 11,
        start_at: isoDate('2026-05-10'),
        duration_hours: 12,
        operational_status: 'REALIZADO',
        financial_status: 'PAGO',
        amount_total: 260,
        amount_paid: 260,
        amount_balance: 0,
        payment_due_date: '2026-05-15',
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        counts_in_financial: 1,
      },
      {
        id: 12,
        user_id: 11,
        start_at: isoDate('2026-05-11'),
        duration_hours: 8,
        operational_status: 'REALIZADO',
        financial_status: 'PAGO',
        amount_total: 180,
        amount_paid: 180,
        amount_balance: 0,
        payment_due_date: '2026-05-16',
        service_type_key: 'proeis',
        service_type_name: 'PROEIS',
        counts_in_financial: 1,
      },
      {
        id: 13,
        user_id: 11,
        start_at: isoDate('2026-05-12'),
        duration_hours: 6,
        operational_status: 'REALIZADO',
        financial_status: 'NAO_PAGO',
        amount_total: 100,
        amount_paid: 0,
        amount_balance: 100,
        payment_due_date: '2026-05-20',
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        counts_in_financial: 1,
      },
    ];

    const response = await request(app)
      .get(
        '/api/v1/finance/report?start_date=2026-05-01&end_date=2026-05-31&service_type=ras_voluntary&financial_status=PAGO'
      )
      .set('Authorization', authHeader({ id: 11, role: 'POLICE', email: 'user11@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].service_type).toBe('ras_voluntary');
    expect(response.body.data.items[0].financial_status).toBe('PAGO');
    expect(response.body.data.by_service_type).toHaveLength(1);
    expect(response.body.data.by_service_type[0].service_type).toBe('ras_voluntary');
  });

  test('summary ignora soft delete', async () => {
    mockState.services = [
      {
        id: 21,
        user_id: 12,
        start_at: isoDate('2026-05-13'),
        duration_hours: 12,
        operational_status: 'REALIZADO',
        financial_status: 'PAGO',
        amount_total: 200,
        amount_paid: 200,
        amount_balance: 0,
        payment_due_date: '2026-05-18',
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        counts_in_financial: 1,
        deleted_at: '2026-05-14T10:00:00.000Z',
      },
    ];

    const response = await request(app)
      .get('/api/v1/finance/summary?month=2026-05')
      .set('Authorization', authHeader({ id: 12, role: 'POLICE', email: 'user12@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.total_expected).toBe(0);
  });

  test('overdue considera data local e nao marca vencimento de hoje', async () => {
    const now = new Date();
    const todayKey = toDateKeyInTimeZone(now);
    const yesterdayKey = toDateKeyInTimeZone(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    mockState.services = [
      {
        id: 30,
        user_id: 13,
        start_at: isoDate('2026-05-13'),
        duration_hours: 12,
        operational_status: 'REALIZADO',
        financial_status: 'NAO_PAGO',
        amount_total: 100,
        amount_paid: 0,
        amount_balance: 100,
        payment_due_date: todayKey,
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        service_type_category: 'RAS',
        counts_in_financial: 1,
      },
      {
        id: 31,
        user_id: 13,
        start_at: isoDate('2026-05-14'),
        duration_hours: 12,
        operational_status: 'REALIZADO',
        financial_status: 'NAO_PAGO',
        amount_total: 90,
        amount_paid: 0,
        amount_balance: 90,
        payment_due_date: yesterdayKey,
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        service_type_category: 'RAS',
        counts_in_financial: 1,
      },
    ];

    const response = await request(app)
      .get('/api/v1/finance/summary?month=2026-05')
      .set('Authorization', authHeader({ id: 13, role: 'POLICE', email: 'user13@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.total_overdue).toBe(90);
  });

  test('dupla blindagem exclui ORDINARY mesmo com counts_in_financial = 1', async () => {
    mockState.services = [
      {
        id: 32,
        user_id: 14,
        start_at: isoDate('2026-05-15'),
        duration_hours: 24,
        operational_status: 'REALIZADO',
        financial_status: 'PAGO',
        amount_total: 400,
        amount_paid: 400,
        amount_balance: 0,
        payment_due_date: null,
        service_type_key: 'ordinary_shift',
        service_type_name: 'Escala Ordinaria',
        service_type_category: 'ORDINARY',
        counts_in_financial: 1,
      },
    ];

    const response = await request(app)
      .get('/api/v1/finance/summary?month=2026-05')
      .set('Authorization', authHeader({ id: 14, role: 'POLICE', email: 'user14@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.total_expected).toBe(0);
    expect(response.body.data.total_received).toBe(0);
  });

  test('PAGO inconsistente usa valor seguro no recebido', async () => {
    mockState.services = [
      {
        id: 33,
        user_id: 15,
        start_at: isoDate('2026-05-16'),
        duration_hours: 12,
        operational_status: 'REALIZADO',
        financial_status: 'PAGO',
        amount_total: 220,
        amount_paid: 120,
        amount_balance: 100,
        payment_due_date: null,
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        service_type_category: 'RAS',
        counts_in_financial: 1,
      },
    ];

    const response = await request(app)
      .get('/api/v1/finance/summary?month=2026-05')
      .set('Authorization', authHeader({ id: 15, role: 'POLICE', email: 'user15@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.total_received).toBe(120);
  });
  test('summary inclui PENDENTE e EM_ATRASO nos totais financeiros reais', async () => {
    mockState.services = [
      {
        id: 40,
        user_id: 16,
        start_at: isoDate('2026-05-16'),
        duration_hours: 12,
        operational_status: 'REALIZADO',
        financial_status: 'PENDENTE',
        amount_total: 140,
        amount_paid: 0,
        amount_balance: 140,
        payment_due_date: '2026-06-10',
        service_type_key: 'ras_voluntary',
        service_type_name: 'RAS Voluntario',
        service_type_category: 'RAS',
        counts_in_financial: 1,
      },
      {
        id: 41,
        user_id: 16,
        start_at: isoDate('2026-05-17'),
        duration_hours: 8,
        operational_status: 'TITULAR',
        financial_status: 'EM_ATRASO',
        amount_total: 60,
        amount_paid: 0,
        amount_balance: 60,
        payment_due_date: '2026-06-12',
        service_type_key: 'proeis',
        service_type_name: 'PROEIS',
        service_type_category: 'PROEIS',
        counts_in_financial: 1,
      },
    ];

    const response = await request(app)
      .get('/api/v1/finance/summary?month=2026-05')
      .set('Authorization', authHeader({ id: 16, role: 'POLICE', email: 'user16@local' }));

    expect(response.status).toBe(200);
    expect(response.body.data.total_expected).toBe(200);
    expect(response.body.data.total_pending).toBe(200);
    expect(response.body.data.total_overdue).toBe(60);
    expect(response.body.data.by_status.PENDENTE).toBe(140);
    expect(response.body.data.by_status.EM_ATRASO).toBe(60);
  });
});
