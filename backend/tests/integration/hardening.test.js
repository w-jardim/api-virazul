const request = require('supertest');
const jwt = require('jsonwebtoken');

function setBaseEnv(overrides = {}) {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3000';
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = '3306';
  process.env.DB_NAME = 'viraazul_test';
  process.env.DB_USER = 'viraazul_user';
  process.env.DB_PASSWORD = 'virazul_pass';
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CORS_ORIGIN = 'http://allowed.local';
  process.env.RATE_LIMIT_GLOBAL_WINDOW_MS = '900000';
  process.env.RATE_LIMIT_GLOBAL_MAX = '1000';
  process.env.RATE_LIMIT_LOGIN_WINDOW_MS = '900000';
  process.env.RATE_LIMIT_LOGIN_MAX = '10';
  process.env.SUBSCRIPTION_ENFORCE = 'false';
  process.env.SUBSCRIPTION_BLOCKED_STATUSES = 'suspended,cancelled,canceled,inactive';
  process.env.TZ = 'America/Sao_Paulo';

  Object.assign(process.env, overrides);
}

function bootApp({
  envOverrides,
  dbAvailable = true,
  authUser = null,
  subscriptionStatus = null,
} = {}) {
  jest.resetModules();
  setBaseEnv(envOverrides);

  jest.doMock('../../src/config/db', () => ({
    pool: {
      query: jest.fn(),
      getConnection: jest.fn(),
    },
    testConnection: jest.fn().mockImplementation(() => {
      if (dbAvailable) {
        return Promise.resolve(true);
      }
      return Promise.reject(new Error('database unavailable'));
    }),
  }));

  jest.doMock('../../src/modules/auth/auth.repository', () => ({
    findByEmail: jest.fn().mockResolvedValue(authUser),
    findSafeById: jest.fn().mockResolvedValue({
      id: 99,
      name: 'User',
      email: 'user@viraazul.local',
      role: 'POLICE',
    }),
    updateLastLogin: jest.fn().mockResolvedValue(),
  }));

  jest.doMock('../../src/modules/subscriptions/subscriptions.repository', () => ({
    findLatestByUserId: jest.fn().mockResolvedValue(
      subscriptionStatus
        ? {
            id: 1,
            owner_user_id: 99,
            status: subscriptionStatus,
            plan: 'basic',
          }
        : null
    ),
  }));

  return require('../../src/app');
}

describe('Hardening Integration', () => {
  test('adds request id to response and reuses incoming X-Request-Id', async () => {
    const app = bootApp();

    const customId = 'req-custom-123';
    const response = await request(app)
      .get('/api/v1/health')
      .set('X-Request-Id', customId)
      .set('Origin', 'http://allowed.local');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe(customId);
  });

  test('blocks disallowed CORS origin', async () => {
    const app = bootApp();

    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://blocked.local');

    expect(response.status).toBe(403);
    expect(response.body.errors[0].code).toBe('CORS_ORIGIN_NOT_ALLOWED');
  });

  test('applies login rate limit', async () => {
    const app = bootApp({
      envOverrides: {
        RATE_LIMIT_LOGIN_MAX: '2',
      },
      authUser: null,
    });

    const payload = {
      email: 'invalid@viraazul.local',
      password: 'wrong-password',
    };

    const first = await request(app).post('/api/v1/auth/login').send(payload);
    const second = await request(app).post('/api/v1/auth/login').send(payload);
    const third = await request(app).post('/api/v1/auth/login').send(payload);

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(429);
    expect(third.body.errors[0].code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
  });

  test('blocks protected route when subscription is suspended', async () => {
    const app = bootApp({
      envOverrides: {
        SUBSCRIPTION_ENFORCE: 'true',
      },
      subscriptionStatus: 'suspended',
    });

    const token = jwt.sign(
      {
        id: 99,
        email: 'user@viraazul.local',
        role: 'POLICE',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://allowed.local');

    expect(response.status).toBe(403);
    expect(response.body.errors[0].code).toBe('SUBSCRIPTION_BLOCKED');
  });
});
