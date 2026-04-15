const request = require('supertest');

jest.mock('../../src/modules/auth/auth.repository', () => ({
  findByEmail: jest.fn(),
  findByGoogleSub: jest.fn(),
  findSafeById: jest.fn(),
  updateLastLogin: jest.fn(),
  linkGoogleSubByUserId: jest.fn(),
  createGoogleUser: jest.fn(),
}));

jest.mock('../../src/modules/auth/google-token.service', () => ({
  verifyIdToken: jest.fn(),
}));

const authRepository = require('../../src/modules/auth/auth.repository');
const googleTokenService = require('../../src/modules/auth/google-token.service');
const app = require('../../src/app');

describe('Google Auth Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/v1/auth/google logs in existing user linked by email', async () => {
    googleTokenService.verifyIdToken.mockResolvedValue({
      sub: 'google-sub-1',
      email: 'policial.teste@viraazul.local',
      email_verified: true,
      name: 'Policial Teste',
    });

    authRepository.findByGoogleSub.mockResolvedValueOnce(null);
    authRepository.findByEmail
      .mockResolvedValueOnce({
        id: 10,
        name: 'Policial Teste',
        email: 'policial.teste@viraazul.local',
        role: 'POLICE',
        rank_group: 'CABO_SOLDADO',
        subscription: 'free',
        payment_due_date: null,
        google_sub: null,
        created_at: '2026-01-01T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 10,
        name: 'Policial Teste',
        email: 'policial.teste@viraazul.local',
        role: 'POLICE',
        rank_group: 'CABO_SOLDADO',
        subscription: 'free',
        payment_due_date: null,
        google_sub: 'google-sub-1',
        created_at: '2026-01-01T00:00:00.000Z',
      });

    const response = await request(app).post('/api/v1/auth/google').send({
      id_token: 'google-id-token',
    });

    expect(response.status).toBe(200);
    expect(authRepository.linkGoogleSubByUserId).toHaveBeenCalledWith(10, 'google-sub-1');
    expect(response.body.data.user).toMatchObject({
      id: 10,
      email: 'policial.teste@viraazul.local',
      role: 'POLICE',
    });
  });

  test('POST /api/v1/auth/google creates new user when email does not exist', async () => {
    googleTokenService.verifyIdToken.mockResolvedValue({
      sub: 'google-sub-2',
      email: 'novo.usuario@viraazul.local',
      email_verified: true,
      name: 'Novo Usuario',
    });

    authRepository.findByGoogleSub.mockResolvedValue(null);
    authRepository.findByEmail.mockResolvedValue(null);
    authRepository.createGoogleUser.mockResolvedValue({
      id: 11,
      name: 'Novo Usuario',
      email: 'novo.usuario@viraazul.local',
      role: 'POLICE',
      rank_group: null,
      subscription: 'free',
      payment_due_date: null,
      google_sub: 'google-sub-2',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    const response = await request(app).post('/api/v1/auth/google').send({
      id_token: 'google-id-token',
    });

    expect(response.status).toBe(200);
    expect(authRepository.createGoogleUser).toHaveBeenCalled();
    expect(response.body.data.user).toMatchObject({
      id: 11,
      email: 'novo.usuario@viraazul.local',
      role: 'POLICE',
    });
  });
});
