jest.mock('../../src/modules/billing/billing.repository', () => ({
  findPlanByCode: jest.fn(),
  createPayment: jest.fn(),
  updatePayment: jest.fn(),
  findPaymentById: jest.fn(),
  findPaymentByGatewayId: jest.fn(),
  findLatestPaymentByUserId: jest.fn(),
  createWebhookEvent: jest.fn(),
  markWebhookProcessed: jest.fn(),
}));

jest.mock('../../src/modules/subscriptions/subscriptions.repository', () => ({
  findCurrentByUserId: jest.fn(),
  findById: jest.fn(),
  createTrialSubscription: jest.fn(),
  updateSubscriptionStatus: jest.fn(),
  updateSubscriptionCycle: jest.fn(),
  attachGatewayData: jest.fn(),
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  syncLegacyUserFields: jest.fn(),
}));

const billingRepo = require('../../src/modules/billing/billing.repository');
const subscriptionsRepo = require('../../src/modules/subscriptions/subscriptions.repository');
const billingService = require('../../src/modules/billing/billing.service');
const env = require('../../src/config/env');

describe('billing service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    env.mercadoPago.accessToken = 'test-token';
  });

  afterAll(() => {
    delete global.fetch;
  });

  test('createCheckoutPremium suporta plan_starter como plano comercial faturavel', async () => {
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'plan_starter',
      name: 'Starter',
      price_cents: 99,
    });
    billingRepo.createPayment.mockResolvedValue(321);
    subscriptionsRepo.findCurrentByUserId.mockResolvedValue({
      id: 9,
      plan: 'plan_free',
      raw_plan: 'plan_free',
      status: 'active',
    });
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pref-1', init_point: 'https://pay.test/checkout' }),
    });

    const result = await billingService.createCheckoutPremium(12, 'policial@virazul.dev', 'plan_starter');

    expect(billingRepo.findPlanByCode).toHaveBeenCalledWith('plan_starter');
    expect(billingRepo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 12,
        subscriptionId: 9,
        rawPayloadJson: { plan_code: 'plan_starter' },
      })
    );
    expect(result).toMatchObject({
      checkout_url: 'https://pay.test/checkout',
      payment_id: 321,
      plan_code: 'plan_starter',
    });
  });

  test('cancelUserSubscription bloqueia cancelamento durante condicao partner ativa', async () => {
    subscriptionsRepo.findCurrentByUserId.mockResolvedValue({
      id: 10,
      plan: 'plan_starter',
      raw_plan: 'plan_starter',
      status: 'active',
      partner_expires_at: '2099-01-01T00:00:00.000Z',
      current_period_end: '2099-01-30T00:00:00.000Z',
      trial_ends_at: null,
    });

    await expect(billingService.cancelUserSubscription(10)).rejects.toMatchObject({
      code: 'BILLING_FREE_ADMIN_ONLY',
      status: 400,
    });

    expect(subscriptionsRepo.cancelSubscription).not.toHaveBeenCalled();
  });
});
