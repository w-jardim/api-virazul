jest.mock('../../src/modules/admin/admin.repository', () => ({
  findById: jest.fn(),
  updateSubscription: jest.fn(),
}));

jest.mock('../../src/modules/subscriptions/subscriptions.repository', () => ({
  findCurrentByUserId: jest.fn(),
  updateSubscriptionCycle: jest.fn(),
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
});
