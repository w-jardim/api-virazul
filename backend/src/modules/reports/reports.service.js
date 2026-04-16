const repository = require('./reports.repository');
const { OPERATIONAL_STATUSES, FINANCIAL_STATUSES } = require('../services/services.rules');
const { toDateKeyInTimeZone } = require('../alerts/alerts.time');

const OPERATIONAL_CONFIRM_STATUSES = ['TITULAR', 'CONVERTIDO_TITULAR', 'REALIZADO'];
const FINANCIAL_RELEVANT_OPERATIONAL = ['TITULAR', 'CONVERTIDO_TITULAR', 'REALIZADO'];
const KNOWN_SERVICE_TYPES = ['ras_voluntary', 'ras_compulsory', 'proeis', 'ordinary_shift', 'other'];
const PENDING_FINANCIAL_STATUSES = new Set(['NAO_PAGO', 'PENDENTE', 'EM_ATRASO']);
const OVERDUE_FINANCIAL_STATUSES = new Set(['EM_ATRASO']);

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

function toPercent(part, whole) {
  if (!whole || whole <= 0) {
    return 0;
  }
  return Number(((part / whole) * 100).toFixed(2));
}

function normalizeDueDateKey(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const datePart = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const yyyy = String(parsed.getUTCFullYear());
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isFinanciallyRelevant(service) {
  const countsInFinancial = Boolean(service.counts_in_financial);
  const isOrdinaryCategory = service.service_type_category === 'ORDINARY';

  return (
    countsInFinancial &&
    !isOrdinaryCategory &&
    service.operational_status !== 'RESERVA' &&
    FINANCIAL_RELEVANT_OPERATIONAL.includes(service.operational_status)
  );
}

function isPendingFinancialStatus(status) {
  return PENDING_FINANCIAL_STATUSES.has(status);
}

function isOverdueFinancialStatus(service, todayKey) {
  if (!isPendingFinancialStatus(service.financial_status)) {
    return false;
  }

  if (OVERDUE_FINANCIAL_STATUSES.has(service.financial_status)) {
    return true;
  }

  const dueKey = normalizeDueDateKey(service.payment_due_date);
  return Boolean(dueKey && dueKey < todayKey);
}

function groupCountsByStatus(items, field, statuses) {
  const grouped = statuses.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  for (const item of items) {
    const status = item[field];
    if (Object.prototype.hasOwnProperty.call(grouped, status)) {
      grouped[status] += 1;
    }
  }

  return grouped;
}

function calculateReservationMetrics(services, transitions) {
  const totalReservationsCurrent = services.filter((item) => item.operational_status === 'RESERVA').length;
  const convertedReservations = transitions.filter(
    (item) => item.new_operational_status === 'CONVERTIDO_TITULAR'
  ).length;
  const nonConvertedReservations = transitions.filter(
    (item) => item.new_operational_status === 'NAO_CONVERTIDO'
  ).length;
  const totalReservations = totalReservationsCurrent + convertedReservations + nonConvertedReservations;

  return {
    total_reservations: totalReservations,
    converted_reservations: convertedReservations,
    non_converted_reservations: nonConvertedReservations,
    conversion_rate: totalReservations > 0 ? toPercent(convertedReservations, totalReservations) : 0,
  };
}

function calculateFinancialSummary(services, now = new Date()) {
  const todayKey = toDateKeyInTimeZone(now);
  const byFinancialStatus = FINANCIAL_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
  const byServiceType = KNOWN_SERVICE_TYPES.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  let totalExpected = 0;
  let totalReceived = 0;
  let totalPending = 0;
  let totalOverdue = 0;

  for (const service of services) {
    if (!isFinanciallyRelevant(service)) {
      continue;
    }

    const amountTotal = toNonNegativeMoney(service.amount_total);
    const amountBalance = toNonNegativeMoney(service.amount_balance);
    const amountPaid = toNonNegativeMoney(service.amount_paid);

    totalExpected = toMoney(totalExpected + amountTotal);
    if (Object.prototype.hasOwnProperty.call(byFinancialStatus, service.financial_status)) {
      byFinancialStatus[service.financial_status] = toMoney(
        byFinancialStatus[service.financial_status] + amountTotal
      );
    }

    if (!Object.prototype.hasOwnProperty.call(byServiceType, service.service_type_key)) {
      byServiceType[service.service_type_key] = 0;
    }
    byServiceType[service.service_type_key] = toMoney(byServiceType[service.service_type_key] + amountTotal);

    if (service.financial_status === 'PAGO') {
      const safeReceived = amountBalance === 0 ? Math.min(amountPaid || amountTotal, amountTotal) : Math.min(amountPaid, amountTotal);
      totalReceived = toMoney(totalReceived + safeReceived);
    }

    if (isPendingFinancialStatus(service.financial_status)) {
      totalPending = toMoney(totalPending + amountTotal);
      if (isOverdueFinancialStatus(service, todayKey)) {
        totalOverdue = toMoney(totalOverdue + amountTotal);
      }
    }

    if (service.financial_status === 'PAGO_PARCIAL') {
      totalPending = toMoney(totalPending + Math.max(amountBalance, 0));
    }
  }

  const receivedPercent = toPercent(totalReceived, totalExpected);
  const pendingPercent = toPercent(totalPending, totalExpected);
  const topServiceType =
    Object.entries(byServiceType)
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1])[0] || null;

  return {
    summary: {
      total_expected: totalExpected,
      total_received: totalReceived,
      total_pending: totalPending,
      total_overdue: totalOverdue,
      received_percentage: receivedPercent,
      pending_percentage: pendingPercent,
      top_service_type: topServiceType ? topServiceType[0] : null,
    },
    by_financial_status: byFinancialStatus,
    by_service_type: byServiceType,
  };
}

function toDateStart(date) {
  const [year, month, day] = date.split('-').map((value) => Number(value));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function toDateEndExclusive(date) {
  return new Date(toDateStart(date).getTime() + 24 * 60 * 60 * 1000);
}

function parseFilters(query) {
  const filters = {};
  if (query.start_date) {
    filters.startAt = toDateStart(query.start_date);
  }
  if (query.end_date) {
    filters.endAt = toDateEndExclusive(query.end_date);
  }
  if (query.service_type) {
    filters.serviceType = query.service_type;
  }
  if (query.operational_status) {
    filters.operationalStatus = query.operational_status;
  }
  if (query.financial_status) {
    filters.financialStatus = query.financial_status;
  }
  return filters;
}

async function getOperationalReport(userId, query) {
  const filters = parseFilters(query);
  const services = await repository.listOperationalServices(userId, filters);
  const transitions = await repository.listReservationTransitions(userId, filters);
  const serviceIdsInScope = new Set(services.map((item) => Number(item.id)));
  const transitionsInScope = transitions.filter((item) => serviceIdsInScope.has(Number(item.service_id)));

  const confirmedHours = services
    .filter((item) => OPERATIONAL_CONFIRM_STATUSES.includes(item.operational_status))
    .reduce((sum, item) => sum + Number(item.duration_hours || 0), 0);

  const waitingHours = services
    .filter((item) => item.operational_status === 'RESERVA')
    .reduce((sum, item) => sum + Number(item.duration_hours || 0), 0);

  const realizedHours = services
    .filter((item) => item.operational_status === 'REALIZADO')
    .reduce((sum, item) => sum + Number(item.duration_hours || 0), 0);

  return {
    summary: {
      total_services: services.length,
      confirmed_hours: Number(confirmedHours),
      waiting_hours: Number(waitingHours),
      realized_hours: Number(realizedHours),
    },
    by_operational_status: groupCountsByStatus(services, 'operational_status', OPERATIONAL_STATUSES),
    reservation_metrics: calculateReservationMetrics(services, transitionsInScope),
  };
}

async function getFinancialReport(userId, query, now = new Date()) {
  const filters = parseFilters(query);
  const services = await repository.listFinancialServices(userId, filters);
  return calculateFinancialSummary(services, now);
}

module.exports = {
  toPercent,
  groupCountsByStatus,
  calculateReservationMetrics,
  calculateFinancialSummary,
  isFinanciallyRelevant,
  getOperationalReport,
  getFinancialReport,
};
