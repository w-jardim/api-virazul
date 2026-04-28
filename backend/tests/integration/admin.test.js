const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/modules/admin/admin.repository', () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  updateSubscription: jest.fn(),
  updatePaymentStatus: jest.fn(),
  getStats: jest.fn(),
}));

const adminRepository = require('../../src/modules/admin/admin.repository');
const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

const adminAuth = () => authHeader({ id: 1, email: 'admin.master@viraazul.local', role: 'ADMIN_MASTER' });
const policeAuth = () => authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' });

describe('Admin Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/v1/admin/users returns list for ADMIN_MASTER', async () => {
    adminRepository.findAll.mockResolvedValue([
      {
        id: 10,
        name: 'Policial Teste',
        email: 'policial.teste@viraazul.local',
        role: 'POLICE',
        status: 'active',
        subscription: 'plan_free',
        payment_status: null,
        payment_due_date: null,
        rank_group: 'CABO_SOLDADO',
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ]);

    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', adminAuth())
      .expect(200);

    expect(response.body.errors).toBeNull();
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: 10,
      email: 'policial.teste@viraazul.local',
      payment_status: null,
    });
  });

  test('GET /api/v1/admin/users is forbidden for POLICE', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', policeAuth())
      .expect(403);

    expect(response.body.data).toBeNull();
    expect(response.body.errors[0]).toMatchObject({ code: 'FORBIDDEN' });
  });

  test('PATCH /api/v1/admin/users/:id/payment-status updates payment_status', async () => {
    adminRepository.findById.mockResolvedValue({ id: 10, email: 'policial.teste@viraazul.local' });
    adminRepository.updatePaymentStatus.mockResolvedValue({
      id: 10,
      payment_status: 'paid',
    });

    const response = await request(app)
      .patch('/api/v1/admin/users/10/payment-status')
      .set('Authorization', adminAuth())
      .send({ payment_status: 'paid' })
      .expect(200);

    expect(response.body.errors).toBeNull();
    expect(response.body.data).toMatchObject({ id: 10, payment_status: 'paid' });
    expect(adminRepository.updatePaymentStatus).toHaveBeenCalledWith(10, 'paid');
  });

  test('GET /api/v1/admin/stats returns aggregated counts', async () => {
    adminRepository.getStats.mockResolvedValue({
      total_users: 5,
      active_users: 4,
      inactive_users: 1,
      suspended_users: 0,
      plan_free: 1,
      plan_starter: 2,
      plan_pro: 2,
      plan_partner: 0,
    });

    const response = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', adminAuth())
      .expect(200);

    expect(response.body.data).toMatchObject({ total_users: 5, plan_pro: 2 });
  });
});
