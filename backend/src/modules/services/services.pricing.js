const repository = require('./services.repository');
const pricingRepository = require('../pricing/pricing.repository');
const {
  resolveServiceScope,
  toMoney,
} = require('./services.rules');

const DEFAULT_RANK_GROUP = 'CABO_SOLDADO';
const DEFAULT_BASE_VALUES = {
  6: 191.53,
  8: 255.37,
  12: 383.05,
  24: 766.11,
};
const DEFAULT_FINANCIAL_RULES = {
  RAS_VOLUNTARY: { allow_transport: true, transport_amount: 17.10, allow_meal: false, meal_amount: 0 },
  RAS_COMPULSORY: { allow_transport: true, transport_amount: 17.10, allow_meal: false, meal_amount: 0 },
  PROEIS: { allow_transport: true, transport_amount: 17.10, allow_meal: true, meal_amount: 61.26 },
  SEGURANCA_PRESENTE: { allow_transport: true, transport_amount: 17.10, allow_meal: true, meal_amount: 61.26 },
  OTHER: { allow_transport: false, transport_amount: 0, allow_meal: false, meal_amount: 0 },
  ORDINARY: { allow_transport: false, transport_amount: 0, allow_meal: false, meal_amount: 0 },
};

function toNonNegativeMoney(value) {
  return Math.max(toMoney(value), 0);
}

function buildFallbackBase(durationHours) {
  return {
    rank_group: DEFAULT_RANK_GROUP,
    duration_hours: Number(durationHours),
    base_amount: toNonNegativeMoney(DEFAULT_BASE_VALUES[Number(durationHours)] ?? 0),
    source: 'seed_default',
  };
}

function buildFallbackRule(serviceScope) {
  const rule = DEFAULT_FINANCIAL_RULES[serviceScope] || DEFAULT_FINANCIAL_RULES.OTHER;
  return {
    service_scope: serviceScope,
    allow_transport: Boolean(rule.allow_transport),
    transport_amount: toNonNegativeMoney(rule.transport_amount),
    allow_meal: Boolean(rule.allow_meal),
    meal_amount: toNonNegativeMoney(rule.meal_amount),
    source: 'seed_default',
  };
}

async function getBaseValue(durationHours, rankGroup = DEFAULT_RANK_GROUP, referenceDate = null) {
  const row = await repository.findActiveBasePricing(rankGroup, durationHours, referenceDate);
  if (!row) {
    return buildFallbackBase(durationHours);
  }

  return {
    ...row,
    base_amount: toNonNegativeMoney(row.base_amount),
    source: 'pricing_base_values',
  };
}

async function getFinancialRule(serviceScope, referenceDate = null) {
  const row = await repository.findActiveFinancialRule(serviceScope, referenceDate);
  if (!row) {
    return buildFallbackRule(serviceScope);
  }

  return {
    ...row,
    allow_transport: Boolean(row.allow_transport),
    transport_amount: toNonNegativeMoney(row.transport_amount),
    allow_meal: Boolean(row.allow_meal),
    meal_amount: toNonNegativeMoney(row.meal_amount),
    source: 'service_type_financial_rules',
  };
}

async function buildFinancialPreview({
  serviceType,
  durationHours,
  manualAmounts = {},
  rankGroup = DEFAULT_RANK_GROUP,
  userId = null,
  referenceDate = null,
}) {
  const serviceScope = resolveServiceScope(serviceType);

  // Always resolve rank_group from DB when userId is available so that
  // profile rank changes take effect immediately without requiring a
  // frontend session refresh.
  let resolvedRankGroup = rankGroup;
  if (userId) {
    const userRank = await pricingRepository.findUserRankGroup(userId);
    if (userRank) {
      resolvedRankGroup = userRank;
    }
  }

  if (serviceScope === 'ORDINARY') {
    return {
      service_scope: serviceScope,
      rank_group: resolvedRankGroup,
      base_amount: 0,
      transport_amount: 0,
      meal_amount: 0,
      total_amount: 0,
      source: 'ordinary_non_financial',
    };
  }

  if (serviceScope === 'OTHER' || Boolean(serviceType?.requires_manual_value)) {
    const baseAmount = toNonNegativeMoney(manualAmounts.amount_base);
    const transportAmount = toNonNegativeMoney(manualAmounts.amount_transport);
    const mealAmount = toNonNegativeMoney(manualAmounts.amount_meal);
    return {
      service_scope: serviceScope,
      rank_group: resolvedRankGroup,
      base_amount: baseAmount,
      transport_amount: transportAmount,
      meal_amount: mealAmount,
      total_amount: toMoney(baseAmount + transportAmount + mealAmount),
      source: 'manual',
    };
  }

  const [baseValue, financialRule] = await Promise.all([
    getBaseValue(durationHours, resolvedRankGroup, referenceDate),
    getFinancialRule(serviceScope, referenceDate),
  ]);

  const baseAmount = toNonNegativeMoney(baseValue.base_amount);
  const transportAmount = financialRule.allow_transport ? toNonNegativeMoney(financialRule.transport_amount) : 0;
  const mealAmount = financialRule.allow_meal ? toNonNegativeMoney(financialRule.meal_amount) : 0;

  return {
    service_scope: serviceScope,
    rank_group: resolvedRankGroup,
    base_amount: baseAmount,
    transport_amount: transportAmount,
    meal_amount: mealAmount,
    total_amount: toMoney(baseAmount + transportAmount + mealAmount),
    source: `${baseValue.source}:${financialRule.source}`,
  };
}

function applyPreviewToPayload(preview, payload = {}) {
  return {
    amount_base: preview.base_amount,
    amount_meal: preview.meal_amount,
    amount_transport: preview.transport_amount,
    amount_additional: toNonNegativeMoney(payload.amount_additional),
    amount_discount: toNonNegativeMoney(payload.amount_discount),
    amount_paid: toNonNegativeMoney(payload.amount_paid),
  };
}

module.exports = {
  DEFAULT_RANK_GROUP,
  buildFinancialPreview,
  applyPreviewToPayload,
};
