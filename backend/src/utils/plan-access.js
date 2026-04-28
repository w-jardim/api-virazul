const { NEW_PLAN_CODES, PLANS } = require('../constants/plans');
const { resolveEntitlements } = require('./entitlementResolver');

const LEGACY_PLAN_CODE_MAP = {
  free: 'plan_free',
  plan_free: 'plan_free',
  starter: 'plan_starter',
  plan_starter: 'plan_starter',
  pro: 'plan_pro',
  premium: 'plan_pro',
  trial: 'plan_pro',
  plan_pro: 'plan_pro',
  partner: 'plan_partner',
  parceiro: 'plan_partner',
  plan_partner: 'plan_partner',
  local: 'plan_free',
  inicial: 'plan_free',
  preview: 'plan_free',
};

const BLOCKED_SUBSCRIPTION_STATUSES = new Set([
  'suspended',
  'inactive',
  'past_due',
  'expired',
  'canceled',
  'cancelled',
  'rejected',
]);

const PENDING_SUBSCRIPTION_STATUSES = new Set([
  'pending',
  'in_process',
  'authorized',
]);

function normalizePlanCode(planCode, { allowPreview = false, fallback = null } = {}) {
  if (planCode === undefined || planCode === null || planCode === '') {
    return fallback;
  }

  const raw = String(planCode).trim().toLowerCase();

  if (allowPreview && raw === 'preview') {
    return 'preview';
  }

  return LEGACY_PLAN_CODE_MAP[raw] || fallback;
}

function isCanonicalPlanCode(planCode) {
  return NEW_PLAN_CODES.includes(planCode);
}

function isBlockedSubscriptionStatus(status) {
  if (!status) {
    return false;
  }

  return BLOCKED_SUBSCRIPTION_STATUSES.has(String(status).trim().toLowerCase());
}

function isPendingSubscriptionStatus(status) {
  if (!status) {
    return false;
  }

  return PENDING_SUBSCRIPTION_STATUSES.has(String(status).trim().toLowerCase());
}

function hasDateExpired(value, now = new Date()) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return now > parsed;
}

function resolveEffectivePlan({
  rawPlan,
  partnerExpiresAt = null,
  fallbackPlan = 'plan_free',
  allowPreview = false,
  now = new Date(),
} = {}) {
  const normalizedPlan = normalizePlanCode(rawPlan, {
    allowPreview,
    fallback: fallbackPlan,
  });
  const canonicalPlan = normalizedPlan === 'preview' ? 'plan_free' : normalizedPlan;

  if (canonicalPlan === 'plan_partner' && hasDateExpired(partnerExpiresAt, now)) {
    return 'plan_starter';
  }

  return normalizedPlan;
}

function resolvePaymentState({
  planCode,
  subscriptionStatus = null,
  currentPeriodEnd = null,
  trialEndsAt = null,
  now = new Date(),
} = {}) {
  const canonicalPlan = normalizePlanCode(planCode, { fallback: 'plan_free' });
  const status = subscriptionStatus ? String(subscriptionStatus).trim().toLowerCase() : '';

  if (canonicalPlan === 'plan_free') {
    return isBlockedSubscriptionStatus(status) ? 'payment_blocked' : 'payment_exempt';
  }

  if (canonicalPlan === 'plan_partner') {
    return isBlockedSubscriptionStatus(status) ? 'payment_blocked' : 'payment_exempt';
  }

  if (status === 'trialing') {
    return hasDateExpired(trialEndsAt, now) ? 'payment_blocked' : 'payment_ok';
  }

  if (status === 'active') {
    return hasDateExpired(currentPeriodEnd, now) ? 'payment_overdue' : 'payment_ok';
  }

  if (isPendingSubscriptionStatus(status)) {
    return 'payment_pending';
  }

  if (isBlockedSubscriptionStatus(status)) {
    return 'payment_blocked';
  }

  return 'payment_blocked';
}

function resolveAccountAccess({
  rawPlan,
  subscriptionStatus = null,
  currentPeriodEnd = null,
  trialEndsAt = null,
  partnerExpiresAt = null,
  now = new Date(),
} = {}) {
  const normalizedPlan = normalizePlanCode(rawPlan, { fallback: null });
  const effectivePlan = resolveEffectivePlan({
    rawPlan,
    partnerExpiresAt,
    fallbackPlan: 'plan_free',
    now,
  });
  const canonicalPlan = effectivePlan === 'preview' ? 'plan_free' : effectivePlan;
  const paymentState = resolvePaymentState({
    planCode: canonicalPlan,
    subscriptionStatus,
    currentPeriodEnd,
    trialEndsAt,
    now,
  });
  const entitlements = resolveEntitlements(canonicalPlan, paymentState);

  return {
    rawPlan: rawPlan || null,
    normalizedPlan,
    effectivePlan,
    paymentState,
    entitlements,
    isKnownPlan: isCanonicalPlanCode(canonicalPlan),
    isLegacyPlan: Boolean(rawPlan) && normalizedPlan !== null && String(rawPlan) !== normalizedPlan,
    planConfig: PLANS[canonicalPlan] || null,
  };
}

module.exports = {
  LEGACY_PLAN_CODE_MAP,
  normalizePlanCode,
  isCanonicalPlanCode,
  isBlockedSubscriptionStatus,
  isPendingSubscriptionStatus,
  hasDateExpired,
  resolveEffectivePlan,
  resolvePaymentState,
  resolveAccountAccess,
};
