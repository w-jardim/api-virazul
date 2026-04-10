const jwtUtils = require('../../src/utils/jwt');

describe('JWT Unit', () => {
  test('generate token', () => {
    const token = jwtUtils.sign({ id: 10, email: 'user@test.local', role: 'police' });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('validate token', () => {
    const token = jwtUtils.sign({ id: 20, email: 'admin@test.local', role: 'admin' });
    const payload = jwtUtils.verify(token);

    expect(payload).toMatchObject({
      id: 20,
      email: 'admin@test.local',
      role: 'admin',
    });
  });
});
