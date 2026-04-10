const { hashPassword, comparePassword } = require('../../src/utils/password');

describe('Password Unit', () => {
  test('hash password', async () => {
    const hash = await hashPassword('Senha@Segura123');

    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(20);
  });

  test('compare password', async () => {
    const hash = await hashPassword('MinhaSenha@123');

    const valid = await comparePassword('MinhaSenha@123', hash);
    const invalid = await comparePassword('SenhaErrada', hash);

    expect(valid).toBe(true);
    expect(invalid).toBe(false);
  });
});
