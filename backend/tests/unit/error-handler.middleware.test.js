describe('error-handler middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
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

  function createRes() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  }

  test('hides stack trace in production', () => {
    process.env.NODE_ENV = 'production';

    let errorHandler;
    jest.isolateModules(() => {
      errorHandler = require('../../src/middlewares/error-handler');
    });

    const req = {
      requestId: 'req-prod',
      originalUrl: '/api/v1/test',
      method: 'GET',
    };
    const res = createRes();

    errorHandler(new Error('boom'), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const response = res.json.mock.calls[0][0];
    expect(response.errors[0].request_id).toBe('req-prod');
    expect(response.errors[0].code).toBe('INTERNAL_ERROR');
    expect(response.errors[0].stack).toBeUndefined();
    expect(response.errors[0].debug).toBeUndefined();
  });

  test('includes debug information in development', () => {
    process.env.NODE_ENV = 'development';

    let errorHandler;
    jest.isolateModules(() => {
      errorHandler = require('../../src/middlewares/error-handler');
    });

    const req = {
      requestId: 'req-dev',
      originalUrl: '/api/v1/test',
      method: 'GET',
    };
    const res = createRes();

    errorHandler(new Error('boom-dev'), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const response = res.json.mock.calls[0][0];
    expect(response.errors[0].request_id).toBe('req-dev');
    expect(response.errors[0].debug).toBe('boom-dev');
    expect(response.errors[0].stack).toContain('boom-dev');
  });
});
