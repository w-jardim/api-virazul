/**
 * Módulo puro para resolver capabilities canônicas com base em planCode e paymentStatus.
 */

// Matriz de entitlements definida pela especificação
const MATRIX = {
  plan_free: {
    payment_exempt: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: false, isFullAccess: false, hasLimitedTools: false,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: true, requiresUpgradeCta: true,
    },
    payment_pending: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: false, isFullAccess: false, hasLimitedTools: false,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: true, requiresUpgradeCta: true,
    },
    payment_overdue: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: false, isFullAccess: false, hasLimitedTools: false,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: true, requiresUpgradeCta: true,
    },
    payment_blocked: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: false, isFullAccess: false, hasLimitedTools: false,
      hasAds: true, paymentRequired: false, isBillingBlocked: true,
      isPreviewMode: true, requiresUpgradeCta: true,
    },
    payment_ok: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: false, isFullAccess: false, hasLimitedTools: false,
      hasAds: true, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: true, requiresUpgradeCta: true,
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
  plan_partner: {
    payment_exempt: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: true, hasLimitedTools: false,
      hasAds: false, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: false,
    },
    payment_ok: {
      canView: true, canCreate: true, canEdit: true, canDelete: true,
      canPersistData: true, isFullAccess: true, hasLimitedTools: false,
      hasAds: false, paymentRequired: false, isBillingBlocked: false,
      isPreviewMode: false, requiresUpgradeCta: false,
    },
    payment_pending: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: true, isFullAccess: false, hasLimitedTools: false,
      hasAds: false, paymentRequired: false, isBillingBlocked: true,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
    payment_overdue: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: true, isFullAccess: false, hasLimitedTools: false,
      hasAds: false, paymentRequired: false, isBillingBlocked: true,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
    payment_blocked: {
      canView: true, canCreate: false, canEdit: false, canDelete: false,
      canPersistData: true, isFullAccess: false, hasLimitedTools: false,
      hasAds: false, paymentRequired: false, isBillingBlocked: true,
      isPreviewMode: false, requiresUpgradeCta: true,
    },
  },
};

/**
 * Fallback bloqueado para códigos desconhecidos.
 */
const FALLBACK_BLOCKED = {
  canView: true, canCreate: false, canEdit: false, canDelete: false,
  canPersistData: false, isFullAccess: false, hasLimitedTools: false,
  hasAds: true, paymentRequired: true, isBillingBlocked: true,
  isPreviewMode: false, requiresUpgradeCta: true,
};

/**
 * Retorna capabilities com base em plano e status.
 * Para códigos não reconhecidos, retorna fallback bloqueado.
 */
function resolveEntitlements(planCode, paymentStatus) {
  const caps = MATRIX[planCode]?.[paymentStatus];
  return caps ? { ...caps } : { ...FALLBACK_BLOCKED };
}

// Export apenas a função resolveEntitlements
module.exports = { resolveEntitlements };
