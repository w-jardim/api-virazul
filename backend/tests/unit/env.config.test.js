const REQUIRED_BASE = {
  NODE_ENV: 'test',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_NAME: 'viraazul_test',
  DB_USER: 'viraazul_user',
  DB_PASSWORD: 'virazul_pass',
  JWT_SECRET: 'test-secret',
  JWT_EXPIRES_IN: '1h',
  CORS_ORIGIN: 'http://localhost:3000',
  TZ: 'America/Sao_Paulo',
};

describe('env config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('fails fast when required env variable is missing', () => {
    process.env = {
      ...process.env,
      ...REQUIRED_BASE,
    };
    delete process.env.DB_HOST;

    jest.doMock('dotenv', () => ({
      config: jest.fn(),
    }));

    expect(() => {
      jest.isolateModules(() => {
        require('../../src/config/env');
      });
    }).toThrow(/DB_HOST/);
  });

  test('loads successfully when all required variables exist', () => {
    process.env = {
      ...process.env,
      ...REQUIRED_BASE,
    };

    jest.doMock('dotenv', () => ({
      config: jest.fn(),
    }));

    let env;
    jest.isolateModules(() => {
      env = require('../../src/config/env');
    });

    expect(env.db.host).toBe(REQUIRED_BASE.DB_HOST);
    expect(env.jwt.secret).toBe(REQUIRED_BASE.JWT_SECRET);
    expect(env.cors.origins).toContain('http://localhost:3000');
  });
});
