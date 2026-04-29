/**
 * Resolve capabilities for the commercial base plan.
 * Administrative partner is modeled as a temporary condition that overrides
 * the base plan instead of acting as a public plan code.
 */

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
  isPreviewMode: false, requiresUpgradeCta: false, isTemporaryPersistence: false,
};

const FALLBACK_BLOCKED = {
  canView: true, canCreate: false, canEdit: false, canDelete: false,
  canPersistData: false, isFullAccess: false, hasLimitedTools: false,
  hasAds: true, paymentRequired: true, isBillingBlocked: true,
  isPreviewMode: false, requiresUpgradeCta: true, isTemporaryPersistence: false,
};

function resolveEntitlements(planCode, paymentStatus, { partnerActive = false } = {}) {
  if (partnerActive) {
    return { ...PARTNER_OVERRIDE };
  }

  const caps = MATRIX[planCode]?.[paymentStatus];
  return caps ? { ...caps } : { ...FALLBACK_BLOCKED };
}

module.exports = {
  resolveEntitlements,
};
