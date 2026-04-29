describe('checkLimits middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
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

    jest.doMock('dotenv', () => ({
      config: jest.fn(),
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function setup(poolRows = [{ services_created: 0 }]) {
    const query = jest.fn().mockResolvedValue([poolRows]);
    jest.doMock('../../src/config/db', () => ({
      pool: { query },
    }));

    const middleware = require('../../src/middlewares/checkLimits');
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    return { middleware, query, res, next };
  }

  test('permite plano free com persistencia temporaria na sessao', async () => {
    const { middleware, res, next } = setup();
    const req = {
      plan: 'plan_free',
      user: { id: 2 },
      account: {
        invalid_plan: false,
        entitlements: {
          canCreate: true,
          canPersistData: true,
          isBillingBlocked: false,
        },
      },
    };

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('bloqueia plano invalido de forma explicita', async () => {
    const { middleware, res, next } = setup();
    const req = {
      plan: 'desconhecido',
      account: {
        invalid_plan: true,
      },
    };

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Plano invalido ou nao suportado.' });
  });

  test('bloqueia starter inadimplente usando entitlements canonicos', async () => {
    const { middleware, res, next } = setup();
    const req = {
      plan: 'plan_starter',
      account: {
        invalid_plan: false,
        entitlements: {
          canCreate: false,
          canPersistData: true,
          isBillingBlocked: true,
        },
      },
    };

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Pagamento pendente' });
  });
});
