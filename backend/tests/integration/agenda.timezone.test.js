const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/modules/agenda/agenda.repository', () => ({
  listByUserInRange: jest.fn(),
}));

const repository = require('../../src/modules/agenda/agenda.repository');
const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

describe('Agenda timezone handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('day boundary includes items at local midnight correctly', async () => {
    // user in Sao Paulo (UTC-3)
    // item at 2026-04-10T23:59:00Z -> in Sao Paulo it is 2026-04-10 20:59 (previous day)
    // item at 2026-04-11T02:01:00Z -> in Sao Paulo 2026-04-10 23:01 (still same local day)

    const items = [
      { id: 1, start_at: '2026-04-10T23:59:00.000Z' },
      { id: 2, start_at: '2026-04-11T02:01:00.000Z' },
    ];

    repository.listByUserInRange.mockResolvedValue(items);

    const response = await request(app)
      .get('/api/v1/agenda/day')
      .set('Authorization', authHeader({ id: 2, email: 'policial@virazul.local', role: 'POLICE' }))
      .query({ date: '2026-04-10' });

    expect(response.status).toBe(200);
    // both items should be considered in local day 2026-04-10
    expect(response.body.data.confirmed.length + response.body.data.reservations.length).toBe(2);
  });
});
