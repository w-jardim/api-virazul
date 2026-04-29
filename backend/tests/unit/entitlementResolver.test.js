const { resolveEntitlements } = require('../../src/utils/entitlementResolver');

const MATRIX = {
  plan_free: {
    payment_exempt: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: true, isTemporaryPersistence: true,
    },
    payment_pending: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: true, isTemporaryPersistence: true,
    },
    payment_overdue: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: true, isTemporaryPersistence: true,
    },
    payment_blocked: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: true, isTemporaryPersistence: true,
    },
    payment_ok: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: true, isTemporaryPersistence: true,
    },
  },
  plan_starter: {
    payment_ok: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: true, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
    payment_pending: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: true, isBillingBlocked: true,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
    payment_overdue: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: true, isBillingBlocked: true,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
    payment_blocked: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: true, isBillingBlocked: true,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
    payment_exempt: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: false, hasLimitedTools: true,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
  },
  plan_pro: {
    payment_ok: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: true, hasLimitedTools: false,
      hasAds: false, paymentRequired: true, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: false,
    },
    payment_pending: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: true, isFullAccess: false, hasLimitedTools: false,
      hasAds: false, paymentRequired: true, isBillingBlocked: true,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
    payment_overdue: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: true, isFullAccess: false, hasLimitedTools: false,
      hasAds: false, paymentRequired: true, isBillingBlocked: true,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
    payment_blocked: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: true, isFullAccess: false, hasLimitedTools: false,
      hasAds: false, paymentRequired: true, isBillingBlocked: true,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
    payment_exempt: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: true, hasLimitedTools: false,
      hasAds: false, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: false,
    },
  },
};

const PARTNER_OVERRIDE = {
  canView: true, canCreate: true, canEdit: true, canDelete: true,
  canPersistData: true, isFullAccess: true, hasLimitedTools: false,
  hasAds: false, paymentRequired: false, isBillingBlocked: false,
  isPreviewMode: false, requiresUpgradeCta: false,
  isTemporaryPersistence: false,
};

const FALLBACK_BLOCKED = {
  canView: true, canCreate: false, canEdit: false, canDelete: false,
  canPersistData: false, isFullAccess: false, hasLimitedTools: false,
  hasAds: true, paymentRequired: true, isBillingBlocked: true,
  isPreviewMode: false, requiresUpgradeCta: true, isTemporaryPersistence: false,
};

describe('resolveEntitlements', () => {
  Object.entries(MATRIX).forEach(([plan, statuses]) => {
    Object.entries(statuses).forEach(([status, expected]) => {
      it(`${plan} / ${status}`, () => {
        expect(resolveEntitlements(plan, status)).toEqual(expected);
      });
    });
  });

  it('aplica override administrativo partner sem trocar o plano base', () => {
    expect(resolveEntitlements('plan_starter', 'payment_overdue', { partnerActive: true })).toEqual(PARTNER_OVERRIDE);
  });

  it('retorna fallback bloqueado para plano desconhecido', () => {
    expect(resolveEntitlements('foo', 'payment_ok')).toEqual(FALLBACK_BLOCKED);
  });

  it('retorna fallback bloqueado para status desconhecido', () => {
    expect(resolveEntitlements('plan_free', 'bar')).toEqual(FALLBACK_BLOCKED);
  });
});
