const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/modules/service-types/service-types.repository', () => ({
  listAll: jest.fn(),
  findByKey: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

const repository = require('../../src/modules/service-types/service-types.repository');
const env = require('../../src/config/env');
const app = require('../../src/app');

function authHeader(payload) {
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  return `Bearer ${token}`;
}

describe('Service Types Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listar tipos de servico', async () => {
    repository.listAll.mockResolvedValue([
      { id: 1, key: 'ordinary_shift', name: 'Escala Ordinaria', category: 'ORDINARY' },
    ]);

    const response = await request(app)
      .get('/api/v1/service-types')
      .set('Authorization', authHeader({ id: 1, email: 'admin.master@viraazul.local', role: 'ADMIN_MASTER' }));

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeNull();
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('criar tipo como admin', async () => {
    repository.findByKey.mockResolvedValue(null);
    repository.create.mockResolvedValue({
      id: 10,
      key: 'new_type',
      name: 'Novo Tipo',
      category: 'OTHER',
    });

    const response = await request(app)
      .post('/api/v1/service-types')
      .set('Authorization', authHeader({ id: 1, email: 'admin.master@viraazul.local', role: 'ADMIN_MASTER' }))
      .send({
        key: 'new_type',
        name: 'Novo Tipo',
        category: 'OTHER',
      });

    expect(response.status).toBe(201);
    expect(response.body.errors).toBeNull();
    expect(response.body.data).toHaveProperty('key', 'new_type');
  });

  test('bloquear criacao de tipo como usuario comum', async () => {
    const response = await request(app)
      .post('/api/v1/service-types')
      .set('Authorization', authHeader({ id: 2, email: 'policial@viraazul.local', role: 'POLICE' }))
      .send({
        key: 'forbidden_type',
        name: 'Tipo Bloqueado',
        category: 'OTHER',
      });

    expect(response.status).toBe(403);
    expect(response.body.data).toBeNull();
    expect(response.body.errors[0].code).toBe('FORBIDDEN');
  });
});

