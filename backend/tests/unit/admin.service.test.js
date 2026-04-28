jest.mock('../../src/modules/admin/admin.repository', () => ({
  findById: jest.fn(),
  updateSubscription: jest.fn(),
  updatePaymentStatus: jest.fn(),
}));

jest.mock('../../src/modules/subscriptions/subscriptions.repository', () => ({
  findCurrentByUserId: jest.fn(),
  updateSubscriptionCycle: jest.fn(),
  updateLatestStatusByUserId: jest.fn(),
  createSubscription: jest.fn(),
  syncLegacyUserFields: jest.fn(),
}));

const adminRepository = require('../../src/modules/admin/admin.repository');
const subscriptionsRepository = require('../../src/modules/subscriptions/subscriptions.repository');
const adminService = require('../../src/modules/admin/admin.service');

describe('admin service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normaliza partner legado e mantem subscriptions como fonte de verdade ativa', async () => {
    adminRepository.findById
      .mockResolvedValueOnce({ id: 7, subscription: 'plan_starter' })
      .mockResolvedValueOnce({ id: 7, subscription: 'plan_partner', payment_status: null, payment_due_date: null });
    adminRepository.updateSubscription.mockResolvedValue({ id: 7, subscription: 'plan_partner' });
    subscriptionsRepository.findCurrentByUserId.mockResolvedValue({
      id: 21,
      status: 'canceled',
      partner_expires_at: '2030-01-01T00:00:00.000Z',
    });

    const result = await adminService.changeSubscription(7, 'partner');

    expect(adminRepository.updateSubscription).toHaveBeenCalledWith(7, 'plan_partner');
    expect(subscriptionsRepository.updateSubscriptionCycle).toHaveBeenCalledWith(
      21,
      expect.objectContaining({
        status: 'active',
        plan: 'plan_partner',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        partnerExpiresAt: '2030-01-01T00:00:00.000Z',
      })
    );
    expect(subscriptionsRepository.syncLegacyUserFields).toHaveBeenCalledWith(7, {
      subscription: 'plan_partner',
      paymentStatus: null,
      paymentDueDate: null,
    });
    expect(result).toMatchObject({
      id: 7,
      subscription: 'plan_partner',
      payment_status: null,
      payment_due_date: null,
    });
  });

  test('troca para free cria assinatura canonica ativa quando usuario ainda nao possui linha em subscriptions', async () => {
    adminRepository.findById
      .mockResolvedValueOnce({ id: 9, subscription: 'plan_pro' })
      .mockResolvedValueOnce({ id: 9, subscription: 'plan_free', payment_status: null, payment_due_date: null });
    adminRepository.updateSubscription.mockResolvedValue({ id: 9, subscription: 'plan_free' });
    subscriptionsRepository.findCurrentByUserId.mockResolvedValue(null);

    await adminService.changeSubscription(9, 'plan_free');

    expect(subscriptionsRepository.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        plan: 'plan_free',
        status: 'active',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        partnerExpiresAt: null,
      })
    );
    expect(subscriptionsRepository.syncLegacyUserFields).toHaveBeenCalledWith(9, {
      subscription: 'plan_free',
      paymentStatus: null,
      paymentDueDate: null,
    });
  });

  test('changePaymentStatus sincroniza plan_pro para subscriptions.status active', async () => {
    adminRepository.findById
      .mockResolvedValueOnce({ id: 12, subscription: 'plan_pro', role: 'POLICE', payment_due_date: '2026-06-10' });
    adminRepository.updatePaymentStatus.mockResolvedValue({
      id: 12,
      subscription: 'plan_pro',
      payment_status: 'paid',
    });
    subscriptionsRepository.findCurrentByUserId.mockResolvedValue({
      id: 55,
      plan: 'plan_pro',
      status: 'past_due',
    });

    const result = await adminService.changePaymentStatus(12, 'paid');

    expect(subscriptionsRepository.updateLatestStatusByUserId).toHaveBeenCalledWith(12, 'active');
    expect(adminRepository.updatePaymentStatus).toHaveBeenCalledWith(12, 'paid');
    expect(result).toMatchObject({
      id: 12,
      subscription: 'plan_pro',
      payment_status: 'paid',
    });
  });

  test('changePaymentStatus cria assinatura canonica quando starter nao possui linha em subscriptions', async () => {
    adminRepository.findById
      .mockResolvedValueOnce({ id: 13, subscription: 'plan_starter', role: 'POLICE', payment_due_date: '2026-06-15' });
    adminRepository.updatePaymentStatus.mockResolvedValue({
      id: 13,
      subscription: 'plan_starter',
      payment_status: 'overdue',
    });
    subscriptionsRepository.findCurrentByUserId.mockResolvedValue(null);

    await adminService.changePaymentStatus(13, 'overdue');

    expect(subscriptionsRepository.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 13,
        plan: 'plan_starter',
        status: 'past_due',
        currentPeriodEnd: '2026-06-15',
      })
    );
    expect(adminRepository.updatePaymentStatus).toHaveBeenCalledWith(13, 'overdue');
  });

  test('changePaymentStatus limpa snapshot legado para plano isento sem forcar subscriptions', async () => {
    adminRepository.findById
      .mockResolvedValueOnce({ id: 14, subscription: 'plan_partner', role: 'POLICE' });
    adminRepository.updatePaymentStatus.mockResolvedValue({
      id: 14,
      subscription: 'plan_partner',
      payment_status: null,
      payment_due_date: null,
    });

    const result = await adminService.changePaymentStatus(14, 'pending');

    expect(subscriptionsRepository.findCurrentByUserId).not.toHaveBeenCalled();
    expect(subscriptionsRepository.updateLatestStatusByUserId).not.toHaveBeenCalled();
    expect(adminRepository.updatePaymentStatus).toHaveBeenCalledWith(14, null);
    expect(result).toMatchObject({
      id: 14,
      subscription: 'plan_partner',
      payment_status: null,
    });
  });
});
