const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/modules/services/services.repository', () => ({
  findServiceTypeById: jest.fn(),
  getUserPreferenceRuleB: jest.fn(),
  getUserPlanningPreferences: jest.fn(),
  createService: jest.fn(),
  list: jest.fn(),
  getDateRange: jest.fn(),
  findById: jest.fn(),
  updateService: jest.fn(),
  softDelete: jest.fn(),
  getConnection: jest.fn(),
  findByIdForUpdate: jest.fn(),
  applyTransition: jest.fn(),
  createStatusHistory: jest.fn(),
  syncPendingFinancialStatuses: jest.fn(),
  syncOverdueFinancialStatuses: jest.fn(),
  findOverlaps: jest.fn(),
  findActiveBasePricing: jest.fn(),
  findActiveFinancialRule: jest.fn(),
}));

jest.mock('../../src/modules/subscriptions/subscriptions.repository', () => ({
  findLatestByUserId: jest.fn(async () => null),
  findCurrentByUserId: jest.fn(async () => ({
    id: 1,
    plan: 'plan_free',
    raw_plan: 'plan_free',
    status: 'active',
    current_period_end: null,
    trial_ends_at: null,
    partner_expires_at: null,
  })),
  updateSubscriptionStatus: jest.fn(),
  syncLegacyUserFields: jest.fn(),
}));

jest.mock('../../src/config/db', () => ({
  pool: {
    query: jest.fn(async (sql) => {
      if (sql.includes('SELECT status, subscription, payment_status, payment_due_date FROM users')) {
        return [[{
          status: 'active',
          subscription: 'plan_free',
          payment_status: null,
          payment_due_date: null,
        }]];
      }

      if (sql.includes('SELECT services_created FROM usage_metrics')) {
        return [[{ services_created: 0 }]];
      }

      return [[]];
    }),
  },
}));

jest.mock('../../src/services/usageService', () => ({
  incrementUsage: jest.fn(async () => undefined),
}));

jest.mock('../../src/modules/pricing/pricing.repository', () => ({
  findUserRankGroup: jest.fn(async () => null),
  VALID_RANK_GROUPS: ['OFICIAIS_SUPERIORES', 'CAPITAO_TENENTE', 'SUBTENENTE_SARGENTO', 'CABO_SOLDADO'],
  VALID_SERVICE_SCOPES: ['RAS', 'PROEIS', 'SEGURANCA_PRESENTE', 'OUTROS'],
}));

jest.mock('../../src/modules/planning/planning.repository', () => ({
  getMonthlyHours: jest.fn(async () => ({
    confirmed_hours: 0,
    waiting_hours: 0,
  })),
}));

const repository = require('../../src/modules/services/services.repository');
const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign({ sid: 'sessao-free-teste', ...payload }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

describe('Services Freemium Session Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findOverlaps.mockResolvedValue([]);
    repository.list.mockResolvedValue([]);
    repository.getUserPlanningPreferences.mockResolvedValue(null);
    repository.findServiceTypeById.mockResolvedValue({
      id: 2,
      key: 'ras_voluntary',
      allows_reservation: 1,
      counts_in_financial: 1,
    });
  });

  test('plan_free persiste dados temporarios vinculados a sessao freemium', async () => {
    repository.createService.mockImplementation(async (payload) => ({
      id: 55,
      user_id: payload.user_id,
      service_type_id: payload.service_type_id,
      start_at: payload.start_at,
      duration_hours: payload.duration_hours,
      operational_status: payload.operational_status,
      financial_status: payload.financial_status,
      notes: payload.notes,
      financial_snapshot: payload.financial_snapshot,
    }));

    const response = await request(app)
      .post('/api/v1/services')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        service_type_id: 2,
        start_at: '2026-04-10T08:00:00.000Z',
        duration_hours: 12,
        operational_status: 'TITULAR',
        financial_status: 'PENDENTE',
        amount_base: 120,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(55);
    expect(response.body.data.financial_snapshot.freemium_session).toEqual(
      expect.objectContaining({
        temporary: true,
        plan: 'plan_free',
      })
    );
    expect(repository.createService).toHaveBeenCalledTimes(1);
  });
});
