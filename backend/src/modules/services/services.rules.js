const AppError = require('../../utils/app-error');

const DURATION_ALLOWED = [6, 8, 12, 24];
const INITIAL_OPERATIONAL_STATUSES = ['TITULAR', 'RESERVA'];
const OPERATIONAL_STATUSES = [
  ...INITIAL_OPERATIONAL_STATUSES,
  'CONVERTIDO_TITULAR',
  'REALIZADO',
  'FALTOU',
  'CANCELADO',
  'NAO_CONVERTIDO',
];
const FINANCIAL_STATUSES = [
  'PENDENTE',
  'RECEBIDO',
];
const SERVICE_SCOPES = [
  'ORDINARY',
  'RAS_VOLUNTARY',
  'RAS_COMPULSORY',
  'PROEIS',
  'SEGURANCA_PRESENTE',
  'OTHER',
];

function toMoney(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}

function parseAccountingRules(input) {
  if (!input) {
    return {};
  }

  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch (error) {
      return {};
    }
  }

  return typeof input === 'object' ? input : {};
}

function resolveServiceScope(serviceType) {
  const rules = parseAccountingRules(serviceType?.accounting_rules);
  const scope = String(rules.service_scope || '').trim().toUpperCase();
  if (SERVICE_SCOPES.includes(scope)) {
    return scope;
  }

  const key = String(serviceType?.key || '').trim().toLowerCase();
  const category = String(serviceType?.category || '').trim().toUpperCase();

  if (key === 'ordinary_shift' || category === 'ORDINARY') return 'ORDINARY';
  if (key === 'ras_voluntary') return 'RAS_VOLUNTARY';
  if (key === 'ras_compulsory') return 'RAS_COMPULSORY';
  if (key === 'proeis' || category === 'PROEIS') return 'PROEIS';
  if (key === 'seguranca_presente' || category === 'SEGURANCA_PRESENTE') return 'SEGURANCA_PRESENTE';
  return 'OTHER';
}

function isFinancialExtraScope(serviceScope) {
  return !['ORDINARY'].includes(serviceScope);
}

function isValidDuration(hours) {
  return DURATION_ALLOWED.includes(Number(hours));
}

function assertValidDuration(hours) {
  if (!isValidDuration(hours)) {
    throw new AppError(
      'INVALID_DURATION',
      `duration_hours invalido. Permitidos: ${DURATION_ALLOWED.join(', ')}.`,
      400
    );
  }
}

function calculateAmounts(input) {
  const amountBase = toMoney(input.amount_base);
  const amountMeal = toMoney(input.amount_meal);
  const amountTransport = toMoney(input.amount_transport);
  const amountAdditional = toMoney(input.amount_additional);
  const amountDiscount = toMoney(input.amount_discount);
  const amountPaid = toMoney(input.amount_paid);

  const amountTotal = toMoney(
    amountBase + amountMeal + amountTransport + amountAdditional - amountDiscount
  );
  const amountBalance = toMoney(amountTotal - amountPaid);

  return {
    amount_base: amountBase,
    amount_meal: amountMeal,
    amount_transport: amountTransport,
    amount_additional: amountAdditional,
    amount_discount: amountDiscount,
    amount_paid: amountPaid,
    amount_total: amountTotal,
    amount_balance: amountBalance,
  };
}

function assertAmountIntegrity(amounts) {
  if (amounts.amount_total < 0) {
    throw new AppError('INVALID_AMOUNT_TOTAL', 'amount_total nao pode ser negativo.', 400);
  }

  if (amounts.amount_paid < 0) {
    throw new AppError('INVALID_AMOUNT_PAID', 'amount_paid nao pode ser negativo.', 400);
  }

  if (amounts.amount_paid > amounts.amount_total) {
    throw new AppError(
      'INVALID_AMOUNT_PAID',
      'amount_paid nao pode ser maior que amount_total.',
      400
    );
  }

  const expectedBalance = toMoney(amounts.amount_total - amounts.amount_paid);
  if (amounts.amount_balance !== expectedBalance) {
    throw new AppError(
      'INVALID_AMOUNT_BALANCE',
      'amount_balance deve ser igual a amount_total - amount_paid.',
      400
    );
  }

  if (amounts.amount_balance < 0) {
    throw new AppError('INVALID_AMOUNT_BALANCE', 'amount_balance nao pode ser negativo.', 400);
  }
}

function validatePaidPartial(amounts) {
  return amounts.amount_paid > 0 && amounts.amount_balance > 0;
}

function normalizeFinancialStatus(financialStatus) {
  if (financialStatus === 'RECEBIDO' || financialStatus === 'PAGO') {
    return 'RECEBIDO';
  }

  return 'PENDENTE';
}

function validatePaid(amounts) {
  return (
    amounts.amount_total >= 0 &&
    amounts.amount_balance === 0 &&
    amounts.amount_paid === amounts.amount_total
  );
}

function assertFinancialRules(financialStatus, amounts) {
  if (!FINANCIAL_STATUSES.includes(financialStatus)) {
    throw new AppError('INVALID_FINANCIAL_STATUS', 'financial_status invalido.', 400);
  }

  assertAmountIntegrity(amounts);

  if (financialStatus === 'RECEBIDO' && !validatePaid(amounts)) {
    throw new AppError(
      'INVALID_FINANCIAL_PAID',
      'RECEBIDO exige amount_balance = 0 e amount_paid = amount_total.',
      400
    );
  }
}

function isOperationalTransitionAllowed(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) {
    return true;
  }

  const allowed = {
    TITULAR: ['REALIZADO', 'FALTOU', 'CANCELADO'],
    RESERVA: ['CONVERTIDO_TITULAR', 'NAO_CONVERTIDO', 'CANCELADO'],
    CONVERTIDO_TITULAR: ['REALIZADO', 'FALTOU', 'CANCELADO'],
  };

  return (allowed[currentStatus] || []).includes(targetStatus);
}

function assertOperationalTransition(currentStatus, targetStatus) {
  if (!OPERATIONAL_STATUSES.includes(targetStatus)) {
    throw new AppError('INVALID_OPERATIONAL_STATUS', 'operational_status invalido.', 400);
  }

  if (!isOperationalTransitionAllowed(currentStatus, targetStatus)) {
    throw new AppError(
      'INVALID_OPERATIONAL_TRANSITION',
      `Transicao operacional invalida: ${currentStatus} -> ${targetStatus}.`,
      400
    );
  }

  if (currentStatus === 'RESERVA' && targetStatus === 'REALIZADO') {
    throw new AppError(
      'INVALID_OPERATIONAL_TRANSITION',
      'RESERVA nao pode ir para REALIZADO sem conversao.',
      400
    );
  }
}

function assertFinancialCompatibilityWithOperational(operationalStatus, financialStatus) {
  const blockedPaidStatuses = ['CANCELADO', 'FALTOU', 'NAO_CONVERTIDO', 'RESERVA'];

  if (blockedPaidStatuses.includes(operationalStatus) && financialStatus === 'RECEBIDO') {
    throw new AppError(
      'INVALID_FINANCIAL_TRANSITION',
      `${operationalStatus} nao pode ser marcado como RECEBIDO.`,
      400
    );
  }
}

module.exports = {
  DURATION_ALLOWED,
  INITIAL_OPERATIONAL_STATUSES,
  OPERATIONAL_STATUSES,
  FINANCIAL_STATUSES,
  SERVICE_SCOPES,
  parseAccountingRules,
  resolveServiceScope,
  isFinancialExtraScope,
  isValidDuration,
  assertValidDuration,
  calculateAmounts,
  assertAmountIntegrity,
  validatePaidPartial,
  validatePaid,
  normalizeFinancialStatus,
  assertFinancialRules,
  isOperationalTransitionAllowed,
  assertOperationalTransition,
  assertFinancialCompatibilityWithOperational,
  toMoney,
};
