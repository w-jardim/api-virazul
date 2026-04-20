const repository = require('./finance.repository');
const { FINANCIAL_STATUSES } = require('../services/services.rules');

const VALID_OPERATIONAL_FOR_FINANCE = ['TITULAR', 'CONVERTIDO_TITULAR', 'REALIZADO'];
const PENDING_FINANCIAL_STATUSES = new Set(['PENDENTE']);

function toMoney(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(2));
}

function toNonNegativeMoney(value) {
  return Math.max(toMoney(value), 0);
}

function isFinanciallyRelevant(service) {
  const countsInFinancial = Boolean(service.counts_in_financial);
  const isOrdinaryCategory = service.service_type_category === 'ORDINARY';
  return (
    countsInFinancial &&
    !isOrdinaryCategory &&
    service.operational_status !== 'RESERVA' &&
    VALID_OPERATIONAL_FOR_FINANCE.includes(service.operational_status)
  );
}

function isPendingFinancialStatus(status) {
  return PENDING_FINANCIAL_STATUSES.has(status);
}

function computeSafePaidAmount({ amountTotal, amountPaid, amountBalance }) {
  const total = toNonNegativeMoney(amountTotal);
  const paid = toNonNegativeMoney(amountPaid);
  const balance = toNonNegativeMoney(amountBalance);

  if (balance === 0 && paid >= total) {
    return total;
  }

  return Math.min(paid, total);
}

function initializeByStatus() {
  return FINANCIAL_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
}

function calculateSummaryFromServices(services, now = new Date()) {
  void now;
  const byStatus = initializeByStatus();

  let totalExpected = 0;
  let totalReceived = 0;
  let totalPending = 0;
  let totalOverdue = 0;

  for (const service of services) {
    if (!isFinanciallyRelevant(service)) {
      continue;
    }

    const amountTotal = toNonNegativeMoney(service.amount_total);
    const status = service.financial_status;

    totalExpected = toMoney(totalExpected + amountTotal);
    if (Object.prototype.hasOwnProperty.call(byStatus, status)) {
      byStatus[status] = toMoney(byStatus[status] + amountTotal);
    }

    if (status === 'RECEBIDO') {
      const safePaid = computeSafePaidAmount({
        amountTotal,
        amountPaid: service.amount_paid,
        amountBalance: service.amount_balance,
      });
      totalReceived = toMoney(totalReceived + safePaid);
    }

    if (isPendingFinancialStatus(status)) {
      totalPending = toMoney(totalPending + amountTotal);
    }

  }

  return {
    total_expected: totalExpected,
    total_received: totalReceived,
    total_pending: totalPending,
    total_overdue: totalOverdue,
    by_status: byStatus,
  };
}

function groupByServiceType(services, now = new Date()) {
  void now;
  const grouped = new Map();

  for (const service of services) {
    if (!isFinanciallyRelevant(service)) {
      continue;
    }

    const key = service.service_type_key;
    if (!grouped.has(key)) {
      grouped.set(key, {
        service_type: key,
        service_type_name: service.service_type_name,
        total_expected: 0,
        total_received: 0,
        total_pending: 0,
        total_overdue: 0,
      });
    }

    const current = grouped.get(key);
    const amountTotal = toNonNegativeMoney(service.amount_total);
    current.total_expected = toMoney(current.total_expected + amountTotal);

    if (service.financial_status === 'RECEBIDO') {
      const safePaid = computeSafePaidAmount({
        amountTotal,
        amountPaid: service.amount_paid,
        amountBalance: service.amount_balance,
      });
      current.total_received = toMoney(current.total_received + safePaid);
    }

    if (isPendingFinancialStatus(service.financial_status)) {
      current.total_pending = toMoney(current.total_pending + amountTotal);
    }

  }

  return Array.from(grouped.values()).sort((a, b) => a.service_type.localeCompare(b.service_type));
}

function monthToRange(month) {
  const [year, monthNumber] = month.split('-').map((value) => Number(value));
  const startAt = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
  const endAt = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0));
  return { startAt, endAt };
}

function dateToStart(date) {
  const [year, month, day] = date.split('-').map((value) => Number(value));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function dateToExclusiveEnd(date) {
  const start = dateToStart(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

async function getSummary(userId, query) {
  const { startAt, endAt } = monthToRange(query.month);
  const services = await repository.listServicesForFinance(userId, { startAt, endAt });
  return calculateSummaryFromServices(services);
}

async function getReport(userId, query) {
  const filters = {};

  if (query.start_date) {
    filters.startAt = dateToStart(query.start_date);
  }

  if (query.end_date) {
    filters.endAt = dateToExclusiveEnd(query.end_date);
  }

  if (query.service_type) {
    filters.serviceType = query.service_type;
  }

  if (query.financial_status) {
    filters.financialStatus = query.financial_status;
  }

  const services = await repository.listServicesForFinance(userId, filters);
  const summary = calculateSummaryFromServices(services);

  return {
    filters: {
      start_date: query.start_date || null,
      end_date: query.end_date || null,
      service_type: query.service_type || null,
      financial_status: query.financial_status || null,
    },
    summary,
    by_service_type: groupByServiceType(services),
    items: services.filter(isFinanciallyRelevant).map((service) => ({
      id: service.id,
      start_at: service.start_at,
      service_type: service.service_type_key,
      service_type_name: service.service_type_name,
      financial_status: service.financial_status,
      amount_total: toMoney(service.amount_total),
      amount_paid: toMoney(service.amount_paid),
      amount_balance: toMoney(service.amount_balance),
      payment_due_date: service.payment_due_date,
    })),
  };
}

module.exports = {
  calculateSummaryFromServices,
  groupByServiceType,
  isFinanciallyRelevant,
  getSummary,
  getReport,
};
