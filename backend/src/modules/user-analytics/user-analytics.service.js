const AppError = require('../../utils/app-error');
const repository = require('./user-analytics.repository');

function toDateStart(date) {
  const [year, month, day] = String(date)
    .split('-')
    .map((value) => Number(value));

  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('INVALID_DATE_FILTER', 'Data inicial invalida.', 400);
  }

  return parsed;
}

function toDateEndExclusive(date) {
  const parsed = toDateStart(date);
  return new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Number(parsed.toFixed(2));
}

function count(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.trunc(parsed);
}

function parseFilters(query = {}) {
  const filters = {};

  if (query.start_date) {
    filters.startAt = toDateStart(query.start_date);
  }

  if (query.end_date) {
    filters.endAt = toDateEndExclusive(query.end_date);
  }

  if (query.start_date && query.end_date && filters.startAt >= filters.endAt) {
    throw new AppError('INVALID_DATE_RANGE', 'Intervalo de datas invalido.', 400);
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

  const userId = toNumberOrNull(query.user_id);
  if (userId !== null) {
    filters.userId = userId;
  }

  return filters;
}

function aggregateByCategory(servicesByType) {
  const map = new Map();

  for (const item of servicesByType) {
    const key = item.service_type_category || 'OTHER';
    const current = map.get(key) || {
      category: key,
      services_count: 0,
      total_hours: 0,
      total_expected: 0,
    };

    current.services_count += count(item.services_count);
    current.total_hours += Number(item.total_hours || 0);
    current.total_expected += money(item.total_expected);

    map.set(key, current);
  }

  return Array.from(map.values())
    .map((item) => ({
      category: item.category,
      services_count: item.services_count,
      total_hours: Number(item.total_hours.toFixed(2)),
      total_expected: money(item.total_expected),
    }))
    .sort((a, b) => b.services_count - a.services_count);
}

async function getOverview(query = {}) {
  const filters = parseFilters(query);

  const [usersTotal, financialSummary, financialByStatus, operationalSummary, operationalByStatus, servicesByType, trafficSummary, topActiveUsers] = await Promise.all([
    repository.getUsersTotal(filters),
    repository.getFinancialSummary(filters),
    repository.getFinancialByStatus(filters),
    repository.getOperationalSummary(filters),
    repository.getOperationalByStatus(filters),
    repository.getServicesByType(filters),
    repository.getTrafficSummary(filters),
    repository.getTopActiveUsers(filters, 10),
  ]);

  const formattedServicesByType = servicesByType.map((item) => ({
    service_type_id: Number(item.service_type_id),
    service_type_key: item.service_type_key,
    service_type_name: item.service_type_name,
    service_type_category: item.service_type_category,
    services_count: count(item.services_count),
    total_hours: Number(Number(item.total_hours || 0).toFixed(2)),
    total_expected: money(item.total_expected),
  }));

  return {
    scope: {
      start_date: query.start_date || null,
      end_date: query.end_date || null,
      service_type: query.service_type || null,
      user_id: filters.userId || null,
    },
    summary: {
      users_total: count(usersTotal.users_total),
      total_services: count(financialSummary.total_services),
      total_hours: Number(Number(operationalSummary.total_hours || 0).toFixed(2)),
      total_expected: money(financialSummary.total_expected),
      total_paid: money(financialSummary.total_paid),
      total_open_balance: money(financialSummary.total_open_balance),
      total_overdue_balance: money(financialSummary.total_overdue_balance),
    },
    financeiro: {
      summary: {
        total_expected: money(financialSummary.total_expected),
        total_paid: money(financialSummary.total_paid),
        total_open_balance: money(financialSummary.total_open_balance),
        total_overdue_balance: money(financialSummary.total_overdue_balance),
      },
      by_status: financialByStatus.map((item) => ({
        financial_status: item.financial_status,
        services_count: count(item.services_count),
        total_expected: money(item.total_expected),
        total_paid: money(item.total_paid),
        total_open_balance: money(item.total_open_balance),
      })),
    },
    operacional: {
      summary: {
        total_services: count(operationalSummary.total_services),
        total_hours: Number(Number(operationalSummary.total_hours || 0).toFixed(2)),
      },
      by_status: operationalByStatus.map((item) => ({
        operational_status: item.operational_status,
        services_count: count(item.services_count),
        total_hours: Number(Number(item.total_hours || 0).toFixed(2)),
      })),
    },
    services: {
      by_type: formattedServicesByType,
      by_category: aggregateByCategory(formattedServicesByType),
    },
    trafego: {
      summary: {
        users_logged_in_period: count(trafficSummary.users_logged_in_period),
        users_with_service_updates: count(trafficSummary.users_with_service_updates),
        service_updates: count(trafficSummary.service_updates),
        status_transitions: count(trafficSummary.status_transitions),
      },
      top_active_users: topActiveUsers.map((item) => ({
        id: Number(item.id),
        name: item.name,
        email: item.email,
        services_created: count(item.services_created),
        status_changes: count(item.status_changes),
        activity_events: count(item.activity_events),
      })),
    },
  };
}

module.exports = {
  getOverview,
};
