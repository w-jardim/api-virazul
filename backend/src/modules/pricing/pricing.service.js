const AppError = require('../../utils/app-error');
const repository = require('./pricing.repository');
const { toMoney } = require('../services/services.rules');

function toNonNegativeMoney(value) {
  return Math.max(toMoney(value), 0);
}

async function listBaseValues(filters) {
  return repository.listBaseValues(filters);
}

async function listFinancialRules(filters) {
  return repository.listFinancialRules(filters);
}

async function preview({ service_scope, rank_group, duration_hours, date }) {
  const [baseRow, ruleRow] = await Promise.all([
    repository.findActiveBaseValue(rank_group, duration_hours, date || null),
    repository.findActiveFinancialRule(service_scope, date || null),
  ]);

  if (!baseRow) {
    throw new AppError(
      'PRICING_NOT_FOUND',
      `Nenhum valor-base vigente para faixa ${rank_group} e duracao ${duration_hours}h.`,
      404
    );
  }

  if (!ruleRow) {
    throw new AppError(
      'PRICING_NOT_FOUND',
      `Nenhuma regra financeira vigente para modalidade ${service_scope}.`,
      404
    );
  }

  const baseAmount = toNonNegativeMoney(baseRow.base_amount);
  const transportAmount = ruleRow.allow_transport ? toNonNegativeMoney(ruleRow.transport_amount) : 0;
  const mealAmount = ruleRow.allow_meal ? toNonNegativeMoney(ruleRow.meal_amount) : 0;

  return {
    base_amount: baseAmount,
    transport_amount: transportAmount,
    meal_amount: mealAmount,
    total_amount: toMoney(baseAmount + transportAmount + mealAmount),
    pricing_source: 'TABLE',
  };
}

module.exports = {
  listBaseValues,
  listFinancialRules,
  preview,
};
