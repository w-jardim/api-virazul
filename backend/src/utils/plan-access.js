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
  local: 'plan_free',
  inicial: 'plan_free',
  preview: 'plan_free',
};

const PARTNER_PLAN_CODES = new Set(['partner', 'parceiro', 'plan_partner']);

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

  if (PARTNER_PLAN_CODES.has(raw)) {
    return 'plan_partner';
  }

  return LEGACY_PLAN_CODE_MAP[raw] || fallback;
}

function isCanonicalPlanCode(planCode) {
  return NEW_PLAN_CODES.includes(planCode);
}

function isPartnerPlanCode(planCode) {
  if (!planCode) {
    return false;
  }

  return PARTNER_PLAN_CODES.has(String(planCode).trim().toLowerCase());
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

function resolveBasePlan({
  rawPlan,
  userBasePlan = null,
  fallbackPlan = 'plan_free',
} = {}) {
  const normalizedRawPlan = normalizePlanCode(rawPlan, { fallback: null });

  if (normalizedRawPlan && normalizedRawPlan !== 'plan_partner') {
    return normalizedRawPlan;
  }

  const normalizedUserPlan = normalizePlanCode(userBasePlan, { fallback: null });
  if (normalizedUserPlan && normalizedUserPlan !== 'plan_partner') {
    return normalizedUserPlan;
  }

  return isPartnerPlanCode(rawPlan) ? 'plan_starter' : fallbackPlan;
}

function isPartnerActive({
  rawPlan,
  partnerExpiresAt = null,
  now = new Date(),
} = {}) {
  const hasPartnerFlag = isPartnerPlanCode(rawPlan) || Boolean(partnerExpiresAt);
  if (!hasPartnerFlag) {
    return false;
  }

  return !hasDateExpired(partnerExpiresAt, now);
}

function resolvePaymentState({
  planCode,
  subscriptionStatus = null,
  currentPeriodEnd = null,
  trialEndsAt = null,
  partnerActive = false,
  now = new Date(),
} = {}) {
  const canonicalPlan = resolveBasePlan({ rawPlan: planCode, fallbackPlan: 'plan_free' });
  const status = subscriptionStatus ? String(subscriptionStatus).trim().toLowerCase() : '';

  if (partnerActive) {
    return 'payment_exempt';
  }

  if (canonicalPlan === 'plan_free') {
    return 'payment_exempt';
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

  return canonicalPlan === 'plan_free' ? 'payment_exempt' : 'payment_blocked';
}

function resolveAccountAccess({
  rawPlan,
  userBasePlan = null,
  subscriptionStatus = null,
  currentPeriodEnd = null,
  trialEndsAt = null,
  partnerExpiresAt = null,
  now = new Date(),
} = {}) {
  const normalizedPlan = normalizePlanCode(rawPlan, { fallback: null });
  const basePlan = resolveBasePlan({
    rawPlan,
    userBasePlan,
    fallbackPlan: 'plan_free',
  });
  const partnerActive = isPartnerActive({
    rawPlan,
    partnerExpiresAt,
    now,
  });
  const paymentState = resolvePaymentState({
    planCode: basePlan,
    subscriptionStatus,
    currentPeriodEnd,
    trialEndsAt,
    partnerActive,
    now,
  });
  const entitlements = resolveEntitlements(basePlan, paymentState, { partnerActive });

  return {
    rawPlan: rawPlan || null,
    normalizedPlan,
    basePlan,
    effectivePlan: basePlan,
    partnerActive,
    paymentState,
    entitlements,
    isKnownPlan: isCanonicalPlanCode(basePlan),
    isLegacyPlan: Boolean(rawPlan) && normalizedPlan !== null && String(rawPlan) !== normalizedPlan,
    planConfig: PLANS[basePlan] || null,
  };
}

module.exports = {
  LEGACY_PLAN_CODE_MAP,
  PARTNER_PLAN_CODES,
  normalizePlanCode,
  isCanonicalPlanCode,
  isPartnerPlanCode,
  isBlockedSubscriptionStatus,
  isPendingSubscriptionStatus,
  hasDateExpired,
  resolveBasePlan,
  isPartnerActive,
  resolvePaymentState,
  resolveAccountAccess,
};
