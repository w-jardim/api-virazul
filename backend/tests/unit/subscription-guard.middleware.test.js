describe('subscription guard middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function setup({ enforce = 'true', status = null, role = 'POLICE' } = {}) {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '3306';
    process.env.DB_NAME = 'viraazul_test';
    process.env.DB_USER = 'viraazul_user';
    process.env.DB_PASSWORD = 'virazul_pass';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.TZ = 'America/Sao_Paulo';
    process.env.SUBSCRIPTION_ENFORCE = enforce;
    process.env.SUBSCRIPTION_BLOCKED_STATUSES = 'suspended,cancelled,canceled,inactive';

    jest.doMock('dotenv', () => ({
      config: jest.fn(),
    }));

    jest.doMock('../../src/modules/subscriptions/subscriptions.repository', () => ({
      findLatestByUserId: jest.fn().mockResolvedValue(
        status
          ? {
              status,
            }
          : null
      ),
    }));

    const { enforceSubscription } = require('../../src/middlewares/subscription-guard');
    const req = {
      requestId: 'req-1',
      user: {
        id: 10,
        role,
      },
    };
    const res = {};
    const next = jest.fn();

    return { enforceSubscription, req, res, next };
  }

  test('blocks user when subscription status is suspended', async () => {
    const { enforceSubscription, req, res, next } = setup({ status: 'suspended' });

    await enforceSubscription(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const [error] = next.mock.calls[0];
    expect(error.code).toBe('SUBSCRIPTION_BLOCKED');
    expect(error.status).toBe(403);
  });

  test('allows request when enforcement is disabled', async () => {
    const { enforceSubscription, req, res, next } = setup({
      enforce: 'false',
      status: 'suspended',
    });

    await enforceSubscription(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('allows ADMIN_MASTER even when status is blocked', async () => {
    const { enforceSubscription, req, res, next } = setup({
      status: 'cancelled',
      role: 'ADMIN_MASTER',
    });

    await enforceSubscription(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
