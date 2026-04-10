const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('../../src/modules/auth/auth.repository', () => ({
  findByEmail: jest.fn(),
  findSafeById: jest.fn(),
  updateLastLogin: jest.fn(),
}));

const authRepository = require('../../src/modules/auth/auth.repository');
const app = require('../../src/app');

describe('Auth Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/v1/auth/login with valid credentials responds 200 and token', async () => {
    const plainPassword = 'Admin@123456';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    authRepository.findByEmail.mockResolvedValue({
      id: 1,
      name: 'Admin Master',
      email: 'admin.master@viraazul.local',
      password_hash: passwordHash,
      role: 'admin',
    });

    authRepository.updateLastLogin.mockResolvedValue();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin.master@viraazul.local',
        password: plainPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeNull();
    expect(response.body.data).toHaveProperty('token');
    expect(response.body.data.user).toMatchObject({
      id: 1,
      email: 'admin.master@viraazul.local',
      role: 'admin',
    });
  });

  test('POST /api/v1/auth/login with invalid credentials responds error', async () => {
    authRepository.findByEmail.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'naoexiste@viraazul.local',
        password: 'Senha@123456',
      });

    expect(response.status).toBe(401);
    expect(response.body.data).toBeNull();
    expect(response.body.errors[0]).toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  test('GET /api/v1/auth/me without token responds 401', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.data).toBeNull();
    expect(response.body.errors[0]).toHaveProperty('code', 'AUTH_MISSING');
  });

  test('GET /api/v1/auth/me with valid token responds 200', async () => {
    const env = require('../../src/config/env');
    const token = jwt.sign(
      {
        id: 1,
        email: 'admin.master@viraazul.local',
        role: 'admin',
      },
      env.jwt.secret,
      { expiresIn: env.jwt.expiresIn }
    );

    authRepository.findSafeById.mockResolvedValue({
      id: 1,
      name: 'Admin Master',
      email: 'admin.master@viraazul.local',
      role: 'admin',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      last_login_at: '2026-01-01T00:00:00.000Z',
    });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeNull();
    expect(response.body.data).toMatchObject({
      id: 1,
      email: 'admin.master@viraazul.local',
      role: 'admin',
    });
  });
});
