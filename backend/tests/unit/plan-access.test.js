const {
  normalizePlanCode,
  resolveAccountAccess,
  resolvePaymentState,
  resolveBasePlan,
} = require('../../src/utils/plan-access');

describe('plan access utils', () => {
  test('normaliza codigos legados para o padrao canonico e preserva alias partner legado', () => {
    expect(normalizePlanCode('free')).toBe('plan_free');
    expect(normalizePlanCode('starter')).toBe('plan_starter');
    expect(normalizePlanCode('premium')).toBe('plan_pro');
    expect(normalizePlanCode('parceiro')).toBe('plan_partner');
    expect(normalizePlanCode('preview')).toBe('plan_free');
  });

  test('resolve partner como condicao temporaria sobre plano base', () => {
    const active = resolveAccountAccess({
      rawPlan: 'plan_partner',
      userBasePlan: 'plan_starter',
      subscriptionStatus: 'active',
      partnerExpiresAt: '2099-01-01T00:00:00.000Z',
    });
    const expired = resolveAccountAccess({
      rawPlan: 'plan_partner',
      userBasePlan: 'plan_starter',
      subscriptionStatus: 'active',
      partnerExpiresAt: '2000-01-01T00:00:00.000Z',
    });

    expect(active.basePlan).toBe('plan_starter');
    expect(active.partnerActive).toBe(true);
    expect(expired.basePlan).toBe('plan_starter');
    expect(expired.partnerActive).toBe(false);
  });

  test('usa plano base starter como fallback para partner legado sem snapshot valido', () => {
    expect(
      resolveBasePlan({
        rawPlan: 'plan_partner',
        userBasePlan: 'plan_partner',
      })
    ).toBe('plan_starter');
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

  test('partner ativo fica isento de cobranca mesmo sobre plano pago', () => {
    expect(
      resolvePaymentState({
        planCode: 'plan_starter',
        subscriptionStatus: 'past_due',
        partnerActive: true,
      })
    ).toBe('payment_exempt');
  });

  test('entitlement de plan_free permite persistencia temporaria na sessao freemium', () => {
    const access = resolveAccountAccess({
      rawPlan: 'plan_free',
      subscriptionStatus: 'active',
    });

    expect(access.entitlements.canCreate).toBe(true);
    expect(access.entitlements.canPersistData).toBe(true);
    expect(access.entitlements.isTemporaryPersistence).toBe(true);
  });
});
