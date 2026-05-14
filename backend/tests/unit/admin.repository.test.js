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

  test('findAll enriquece usuarios com payment_state, partner_active e entitlements', async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 3,
        name: 'Parceiro Ativo',
        email: 'parceiro@virazul.local',
        role: 'POLICE',
        status: 'active',
        subscription: 'plan_starter',
        payment_status: 'paid',
        payment_due_date: '2026-06-10',
        rank_group: 'CABO_SOLDADO',
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: '2026-05-02T00:00:00.000Z',
        last_login_at: '2026-05-03T00:00:00.000Z',
        subscription_plan: 'plan_starter',
        subscription_status: 'active',
        current_period_end: '2026-06-10',
        trial_ends_at: null,
        partner_expires_at: '2099-01-01T00:00:00.000Z',
      },
    ]]);

    const result = await adminRepository.findAll();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 3,
      subscription: 'plan_starter',
      payment_state: 'payment_exempt',
      partner_active: true,
      entitlements: expect.objectContaining({
        canCreate: true,
        canEdit: true,
        isBillingBlocked: false,
      }),
    });
    expect(result[0]).not.toHaveProperty('subscription_plan');
    expect(result[0]).not.toHaveProperty('subscription_status');
    expect(result[0]).not.toHaveProperty('partner_expires_at');
  });

  test('findById usa fallback legado para resolver payment_state quando nao ha subscription atual', async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 5,
        name: 'Usuario Pago',
        email: 'pago@virazul.local',
        role: 'POLICE',
        status: 'active',
        subscription: 'plan_pro',
        payment_status: 'overdue',
        payment_due_date: '2026-05-10',
        rank_group: null,
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: '2026-05-02T00:00:00.000Z',
        last_login_at: null,
        subscription_plan: null,
        subscription_status: null,
        current_period_end: null,
        trial_ends_at: null,
        partner_expires_at: null,
      },
    ]]);

    const result = await adminRepository.findById(5);

    expect(result).toMatchObject({
      id: 5,
      subscription: 'plan_pro',
      payment_status: 'overdue',
      payment_due_date: '2026-05-10',
      payment_state: 'payment_blocked',
      partner_active: false,
      entitlements: expect.objectContaining({
        canCreate: false,
        canEdit: false,
        isBillingBlocked: true,
      }),
    });
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
