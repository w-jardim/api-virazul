const {
  normalizePlanCode,
  resolveAccountAccess,
  resolvePaymentState,
} = require('../../src/utils/plan-access');

describe('plan access utils', () => {
  test('normaliza codigos legados para o padrao canonico', () => {
    expect(normalizePlanCode('free')).toBe('plan_free');
    expect(normalizePlanCode('starter')).toBe('plan_starter');
    expect(normalizePlanCode('premium')).toBe('plan_pro');
    expect(normalizePlanCode('parceiro')).toBe('plan_partner');
    expect(normalizePlanCode('preview')).toBe('plan_free');
  });

  test('mantem plano partner ativo e rebaixa para starter quando expira', () => {
    const active = resolveAccountAccess({
      rawPlan: 'plan_partner',
      subscriptionStatus: 'active',
      partnerExpiresAt: '2099-01-01T00:00:00.000Z',
    });
    const expired = resolveAccountAccess({
      rawPlan: 'plan_partner',
      subscriptionStatus: 'active',
      partnerExpiresAt: '2000-01-01T00:00:00.000Z',
    });

    expect(active.effectivePlan).toBe('plan_partner');
    expect(expired.effectivePlan).toBe('plan_starter');
  });

  test('traduz status de assinatura paga em payment state bloqueado quando vencido', () => {
    expect(
      resolvePaymentState({
        planCode: 'plan_pro',
        subscriptionStatus: 'active',
        currentPeriodEnd: '2000-01-01T00:00:00.000Z',
      })
    ).toBe('payment_overdue');
  });

  test('entitlement de plan_free permite criar mas nao persistir', () => {
    const access = resolveAccountAccess({
      rawPlan: 'plan_free',
      subscriptionStatus: 'active',
    });

    expect(access.entitlements.canCreate).toBe(true);
    expect(access.entitlements.canPersistData).toBe(false);
  });
});
