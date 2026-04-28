jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

jest.mock('../../src/config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../../src/config/db');
const adminRepository = require('../../src/modules/admin/admin.repository');

describe('admin repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('limpa payment fields ao mudar assinatura para plano isento', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 4, subscription: 'plan_starter', role: 'POLICE', payment_status: 'paid', payment_due_date: '2026-06-10' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 4, subscription: 'plan_free', role: 'POLICE', payment_status: null, payment_due_date: null }]]);

    await adminRepository.updateById(4, {
      subscription: 'plan_free',
      payment_status: 'paid',
      payment_due_date: '2026-06-10',
    });

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('payment_status = ?'),
      expect.arrayContaining(['plan_free', null, null, 4])
    );
  });

  test('getStats usa plano efetivo canonico com fallback no usuario e partner expirado', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total_users: 4, active_users: 3, inactive_users: 1, suspended_users: 0 }]])
      .mockResolvedValueOnce([
        [
          { id: 1, user_subscription: 'plan_free', subscription_plan: null, partner_expires_at: null },
          { id: 2, user_subscription: 'starter', subscription_plan: 'plan_starter', partner_expires_at: null },
          { id: 3, user_subscription: 'plan_partner', subscription_plan: 'plan_partner', partner_expires_at: '2000-01-01T00:00:00.000Z' },
          { id: 4, user_subscription: 'premium', subscription_plan: null, partner_expires_at: null },
        ],
      ]);

    const result = await adminRepository.getStats();

    expect(result).toMatchObject({
      total_users: 4,
      plan_free: 1,
      plan_starter: 2,
      plan_pro: 1,
      plan_partner: 0,
    });
  });

  test('updatePaymentStatus limpa snapshot legado para plano isento', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 8, subscription: 'plan_partner', role: 'POLICE', payment_status: 'pending', payment_due_date: '2026-06-20' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 8, subscription: 'plan_partner', role: 'POLICE', payment_status: null, payment_due_date: null }]]);

    const result = await adminRepository.updatePaymentStatus(8, 'paid');

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET payment_status = NULL, payment_due_date = NULL WHERE id = ? AND deleted_at IS NULL',
      [8]
    );
    expect(result).toMatchObject({
      id: 8,
      subscription: 'plan_partner',
      payment_status: null,
      payment_due_date: null,
    });
  });

  test('updatePaymentStatus atualiza apenas o snapshot legado para plano cobrado', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 9, subscription: 'plan_pro', role: 'POLICE', payment_status: 'pending', payment_due_date: '2026-06-20' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 9, subscription: 'plan_pro', role: 'POLICE', payment_status: 'paid', payment_due_date: '2026-06-20' }]]);

    const result = await adminRepository.updatePaymentStatus(9, 'paid');

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET payment_status = ? WHERE id = ? AND deleted_at IS NULL',
      ['paid', 9]
    );
    expect(result).toMatchObject({
      id: 9,
      subscription: 'plan_pro',
      payment_status: 'paid',
      payment_due_date: '2026-06-20',
    });
  });
});
