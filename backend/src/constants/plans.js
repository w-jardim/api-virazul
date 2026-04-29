const NEW_PLAN_CODES = ['plan_free', 'plan_starter', 'plan_pro'];
const LEGACY_PLAN_CODES = ['plan_partner'];

const ALL_PLAN_CODES = [...NEW_PLAN_CODES, ...LEGACY_PLAN_CODES];

const PLAN_DEFINITIONS = {
  plan_free: {
    code: 'plan_free',
    name: 'Free',
    priceCents: 0,
    currency: 'BRL',
    billingCycle: 'free',
    adsEnabled: true,
    apiCallsMonthly: 1000,
    gateway: null,
    trialDays: 0,
    isCourtesy: false,
    has_ads: true,
    service_limit: Infinity,
    persistence: true,
  },
  plan_starter: {
    code: 'plan_starter',
    name: 'Starter',
    priceCents: 99,
    currency: 'BRL',
    billingCycle: 'monthly',
    adsEnabled: true,
    apiCallsMonthly: 50000,
    gateway: 'stripe',
    trialDays: 0,
    isCourtesy: false,
    has_ads: true,
    service_limit: 5,
    persistence: true,
  },
  plan_pro: {
    code: 'plan_pro',
    name: 'Pro',
    priceCents: 299,
    currency: 'BRL',
    billingCycle: 'monthly',
    adsEnabled: false,
    apiCallsMonthly: 999999,
    gateway: 'stripe',
    trialDays: 7,
    isCourtesy: false,
    has_ads: false,
    service_limit: Infinity,
    persistence: true,
  },
};

const PARTNER_CONDITION = {
  code: 'partner',
  name: 'Partner',
  isCourtesy: true,
  requiresAdminGrant: true,
  has_ads: false,
  persistence: true,
};

// Operational plan map used by middlewares (includes preview for unauthenticated users)
const PLANS = {
  preview: {
    has_ads: true,
    service_limit: 0,
    persistence: false,
  },
  plan_free: PLAN_DEFINITIONS.plan_free,
  plan_starter: PLAN_DEFINITIONS.plan_starter,
  plan_pro: PLAN_DEFINITIONS.plan_pro,
};

function isKnownPlan(code) {
  return ALL_PLAN_CODES.includes(code);
}

module.exports = {
  NEW_PLAN_CODES,
  LEGACY_PLAN_CODES,
  ALL_PLAN_CODES,
  PLAN_DEFINITIONS,
  PARTNER_CONDITION,
  PLANS,
  isKnownPlan,
};
