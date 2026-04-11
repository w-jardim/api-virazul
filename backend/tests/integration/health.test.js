const request = require('supertest');

jest.mock('../../src/config/db', () => ({
  pool: { query: jest.fn() },
  testConnection: jest.fn(),
}));

const db = require('../../src/config/db');
const app = require('../../src/app');

describe('Health and Readiness Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/v1/health responds 200 (liveness)', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeNull();
    expect(response.body.data).toMatchObject({
      status: 'ok',
      environment: expect.any(String),
    });
    expect(response.body.data).toHaveProperty('timestamp');
  });

  test('GET /api/v1/ready responds 200 when dependencies are healthy', async () => {
    db.testConnection.mockResolvedValue(true);

    const response = await request(app).get('/api/v1/ready');

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeNull();
    expect(response.body.data.status).toBe('ready');
    expect(response.body.data.checks).toEqual({
      database: 'up',
      config: 'ok',
    });
  });

  test('GET /api/v1/ready responds 503 when database is down', async () => {
    db.testConnection.mockRejectedValue(new Error('db down'));

    const response = await request(app).get('/api/v1/ready');

    expect(response.status).toBe(503);
    expect(response.body.errors).toBeNull();
    expect(response.body.data.status).toBe('not_ready');
    expect(response.body.data.checks.database).toBe('down');
  });
});
