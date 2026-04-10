const request = require('supertest');

jest.mock('../../src/config/db', () => ({
  testConnection: jest.fn().mockResolvedValue(true),
}));

const app = require('../../src/app');

describe('Healthcheck Integration', () => {
  test('GET /api/v1/health responds 200', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeNull();
    expect(response.body.data).toHaveProperty('status');
    expect(response.body.data).toHaveProperty('timestamp');
    expect(response.body.data).toHaveProperty('environment');
    expect(response.body.data).toHaveProperty('database', 'up');
  });
});
