const NEW_PLAN_CODES = ['plan_free', 'plan_starter', 'plan_pro', 'plan_partner'];
const LEGACY_PLAN_CODES = ['free', 'trial', 'premium'];

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
  },
  plan_partner: {
    code: 'plan_partner',
    name: 'Partner',
    priceCents: 0,
    currency: 'BRL',
    billingCycle: 'free',
    adsEnabled: false,
    apiCallsMonthly: 999999,
    gateway: null,
    trialDays: 0,
    isCourtesy: true,
  },
};

function isKnownPlan(code) {
  return ALL_PLAN_CODES.includes(code);
}

module.exports = {
  NEW_PLAN_CODES,
  LEGACY_PLAN_CODES,
  ALL_PLAN_CODES,
  PLAN_DEFINITIONS,
  isKnownPlan,
};
