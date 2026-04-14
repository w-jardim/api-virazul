const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/modules/pricing/pricing.repository', () => ({
  VALID_RANK_GROUPS: [
    'OFICIAIS_SUPERIORES',
    'CAPITAO_TENENTE',
    'SUBTENENTE_SARGENTO',
    'CABO_SOLDADO',
  ],
  VALID_SERVICE_SCOPES: [
    'RAS_VOLUNTARY',
    'RAS_COMPULSORY',
    'PROEIS',
    'SEGURANCA_PRESENTE',
  ],
  listBaseValues: jest.fn(),
  findActiveBaseValue: jest.fn(),
  listFinancialRules: jest.fn(),
  findActiveFinancialRule: jest.fn(),
  findUserRankGroup: jest.fn(),
}));

const pricingRepo = require('../../src/modules/pricing/pricing.repository');
const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

const adminAuth = () => authHeader({ id: 1, email: 'admin@test.com', role: 'ADMIN_MASTER' });
const policeAuth = () => authHeader({ id: 2, email: 'policial@test.com', role: 'POLICE' });

const baseValueRow = {
  id: 1,
  rank_group: 'CABO_SOLDADO',
  duration_hours: 12,
  base_amount: 383.05,
  effective_start_date: '2024-01-01',
  effective_end_date: null,
  is_active: 1,
};

const rasRule = {
  id: 1,
  service_scope: 'RAS_VOLUNTARY',
  allow_transport: 1,
  transport_amount: 17.10,
  allow_meal: 0,
  meal_amount: 0,
  effective_start_date: '2024-01-01',
  effective_end_date: null,
  is_active: 1,
};

const proeisRule = {
  id: 2,
  service_scope: 'PROEIS',
  allow_transport: 1,
  transport_amount: 17.10,
  allow_meal: 1,
  meal_amount: 61.26,
  effective_start_date: '2024-01-01',
  effective_end_date: null,
  is_active: 1,
};

const segurancaRule = {
  id: 3,
  service_scope: 'SEGURANCA_PRESENTE',
  allow_transport: 1,
  transport_amount: 17.10,
  allow_meal: 1,
  meal_amount: 61.26,
  effective_start_date: '2024-01-01',
  effective_end_date: null,
  is_active: 1,
};

describe('Pricing Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- GET /api/v1/pricing/base-values ---

  describe('GET /api/v1/pricing/base-values', () => {
    test('lista valores-base vigentes', async () => {
      pricingRepo.listBaseValues.mockResolvedValue([baseValueRow]);

      const res = await request(app)
        .get('/api/v1/pricing/base-values')
        .set('Authorization', adminAuth())
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].rank_group).toBe('CABO_SOLDADO');
      expect(pricingRepo.listBaseValues).toHaveBeenCalledTimes(1);
    });

    test('filtra por rank_group e duration_hours', async () => {
      pricingRepo.listBaseValues.mockResolvedValue([baseValueRow]);

      const res = await request(app)
        .get('/api/v1/pricing/base-values?rank_group=CABO_SOLDADO&duration_hours=12')
        .set('Authorization', adminAuth())
        .expect(200);

      expect(pricingRepo.listBaseValues).toHaveBeenCalledWith(
        expect.objectContaining({
          rank_group: 'CABO_SOLDADO',
          duration_hours: 12,
        })
      );
    });

    test('rejeita duracao invalida', async () => {
      const res = await request(app)
        .get('/api/v1/pricing/base-values?duration_hours=7')
        .set('Authorization', adminAuth())
        .expect(400);

      expect(res.body.errors).toBeDefined();
    });

    test('requer autenticacao', async () => {
      await request(app)
        .get('/api/v1/pricing/base-values')
        .expect(401);
    });
  });

  // --- GET /api/v1/pricing/financial-rules ---

  describe('GET /api/v1/pricing/financial-rules', () => {
    test('lista regras financeiras vigentes', async () => {
      pricingRepo.listFinancialRules.mockResolvedValue([rasRule, proeisRule, segurancaRule]);

      const res = await request(app)
        .get('/api/v1/pricing/financial-rules')
        .set('Authorization', policeAuth())
        .expect(200);

      expect(res.body.data).toHaveLength(3);
    });

    test('filtra por service_scope', async () => {
      pricingRepo.listFinancialRules.mockResolvedValue([rasRule]);

      await request(app)
        .get('/api/v1/pricing/financial-rules?service_scope=RAS_VOLUNTARY')
        .set('Authorization', policeAuth())
        .expect(200);

      expect(pricingRepo.listFinancialRules).toHaveBeenCalledWith(
        expect.objectContaining({ service_scope: 'RAS_VOLUNTARY' })
      );
    });
  });

  // --- GET /api/v1/pricing/preview ---

  describe('GET /api/v1/pricing/preview', () => {
    test('RAS sem alimentacao', async () => {
      pricingRepo.findActiveBaseValue.mockResolvedValue(baseValueRow);
      pricingRepo.findActiveFinancialRule.mockResolvedValue(rasRule);

      const res = await request(app)
        .get('/api/v1/pricing/preview?service_scope=RAS_VOLUNTARY&rank_group=CABO_SOLDADO&duration_hours=12')
        .set('Authorization', policeAuth())
        .expect(200);

      expect(res.body.data.base_amount).toBe(383.05);
      expect(res.body.data.transport_amount).toBe(17.10);
      expect(res.body.data.meal_amount).toBe(0);
      expect(res.body.data.total_amount).toBe(400.15);
      expect(res.body.data.pricing_source).toBe('TABLE');
    });

    test('PROEIS com alimentacao', async () => {
      pricingRepo.findActiveBaseValue.mockResolvedValue(baseValueRow);
      pricingRepo.findActiveFinancialRule.mockResolvedValue(proeisRule);

      const res = await request(app)
        .get('/api/v1/pricing/preview?service_scope=PROEIS&rank_group=CABO_SOLDADO&duration_hours=12')
        .set('Authorization', policeAuth())
        .expect(200);

      expect(res.body.data.base_amount).toBe(383.05);
      expect(res.body.data.transport_amount).toBe(17.10);
      expect(res.body.data.meal_amount).toBe(61.26);
      expect(res.body.data.total_amount).toBe(461.41);
      expect(res.body.data.pricing_source).toBe('TABLE');
    });

    test('SEGURANCA_PRESENTE com alimentacao', async () => {
      pricingRepo.findActiveBaseValue.mockResolvedValue(baseValueRow);
      pricingRepo.findActiveFinancialRule.mockResolvedValue(segurancaRule);

      const res = await request(app)
        .get('/api/v1/pricing/preview?service_scope=SEGURANCA_PRESENTE&rank_group=CABO_SOLDADO&duration_hours=12')
        .set('Authorization', policeAuth())
        .expect(200);

      expect(res.body.data.meal_amount).toBe(61.26);
      expect(res.body.data.total_amount).toBe(461.41);
    });

    test('retorna 404 quando valor-base nao encontrado', async () => {
      pricingRepo.findActiveBaseValue.mockResolvedValue(null);
      pricingRepo.findActiveFinancialRule.mockResolvedValue(rasRule);

      const res = await request(app)
        .get('/api/v1/pricing/preview?service_scope=RAS_VOLUNTARY&rank_group=OFICIAIS_SUPERIORES&duration_hours=6')
        .set('Authorization', policeAuth())
        .expect(404);

      expect(res.body.errors[0].code).toBe('PRICING_NOT_FOUND');
    });

    test('retorna 404 quando regra financeira nao encontrada', async () => {
      pricingRepo.findActiveBaseValue.mockResolvedValue(baseValueRow);
      pricingRepo.findActiveFinancialRule.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/pricing/preview?service_scope=RAS_VOLUNTARY&rank_group=CABO_SOLDADO&duration_hours=12')
        .set('Authorization', policeAuth())
        .expect(404);

      expect(res.body.errors[0].code).toBe('PRICING_NOT_FOUND');
    });

    test('rejeita duracao invalida', async () => {
      await request(app)
        .get('/api/v1/pricing/preview?service_scope=RAS_VOLUNTARY&rank_group=CABO_SOLDADO&duration_hours=10')
        .set('Authorization', policeAuth())
        .expect(400);
    });

    test('rejeita rank_group invalido', async () => {
      await request(app)
        .get('/api/v1/pricing/preview?service_scope=RAS_VOLUNTARY&rank_group=INVALIDO&duration_hours=12')
        .set('Authorization', policeAuth())
        .expect(400);
    });

    test('rejeita service_scope invalido', async () => {
      await request(app)
        .get('/api/v1/pricing/preview?service_scope=ORDINARY&rank_group=CABO_SOLDADO&duration_hours=12')
        .set('Authorization', policeAuth())
        .expect(400);
    });

    test('requer campos obrigatorios', async () => {
      await request(app)
        .get('/api/v1/pricing/preview')
        .set('Authorization', policeAuth())
        .expect(400);
    });

    test('respeita vigencia por data', async () => {
      pricingRepo.findActiveBaseValue.mockResolvedValue(baseValueRow);
      pricingRepo.findActiveFinancialRule.mockResolvedValue(rasRule);

      const res = await request(app)
        .get('/api/v1/pricing/preview?service_scope=RAS_VOLUNTARY&rank_group=CABO_SOLDADO&duration_hours=12&date=2025-06-15')
        .set('Authorization', policeAuth())
        .expect(200);

      expect(res.body.data.pricing_source).toBe('TABLE');
    });

    test('requer autenticacao', async () => {
      await request(app)
        .get('/api/v1/pricing/preview?service_scope=RAS_VOLUNTARY&rank_group=CABO_SOLDADO&duration_hours=12')
        .expect(401);
    });
  });

  // --- Seed + Lookup unit tests ---

  describe('Pricing service unit', () => {
    const pricingService = require('../../src/modules/pricing/pricing.service');

    test('preview calcula total correto RAS CABO_SOLDADO 12h', async () => {
      pricingRepo.findActiveBaseValue.mockResolvedValue(baseValueRow);
      pricingRepo.findActiveFinancialRule.mockResolvedValue(rasRule);

      const result = await pricingService.preview({
        service_scope: 'RAS_VOLUNTARY',
        rank_group: 'CABO_SOLDADO',
        duration_hours: 12,
      });

      expect(result.base_amount).toBe(383.05);
      expect(result.transport_amount).toBe(17.10);
      expect(result.meal_amount).toBe(0);
      expect(result.total_amount).toBe(400.15);
      expect(result.pricing_source).toBe('TABLE');
    });

    test('preview calcula total correto PROEIS com alimentacao', async () => {
      pricingRepo.findActiveBaseValue.mockResolvedValue(baseValueRow);
      pricingRepo.findActiveFinancialRule.mockResolvedValue(proeisRule);

      const result = await pricingService.preview({
        service_scope: 'PROEIS',
        rank_group: 'CABO_SOLDADO',
        duration_hours: 12,
      });

      expect(result.meal_amount).toBe(61.26);
      expect(result.total_amount).toBe(461.41);
    });

    test('preview lanca erro quando base nao encontrada', async () => {
      pricingRepo.findActiveBaseValue.mockResolvedValue(null);
      pricingRepo.findActiveFinancialRule.mockResolvedValue(rasRule);

      await expect(
        pricingService.preview({
          service_scope: 'RAS_VOLUNTARY',
          rank_group: 'OFICIAIS_SUPERIORES',
          duration_hours: 6,
        })
      ).rejects.toThrow('Nenhum valor-base vigente');
    });

    test('listBaseValues delega ao repositorio', async () => {
      pricingRepo.listBaseValues.mockResolvedValue([baseValueRow]);
      const result = await pricingService.listBaseValues({ rank_group: 'CABO_SOLDADO' });
      expect(result).toHaveLength(1);
    });

    test('listFinancialRules delega ao repositorio', async () => {
      pricingRepo.listFinancialRules.mockResolvedValue([rasRule, proeisRule]);
      const result = await pricingService.listFinancialRules({});
      expect(result).toHaveLength(2);
    });
  });
});
