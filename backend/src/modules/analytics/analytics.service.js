const reportsRepository = require('../reports/reports.repository');
const reportsService = require('../reports/reports.service');

function toMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function mergeServices(ops, fin) {
  const map = new Map();
  for (const s of ops) {
    map.set(Number(s.id), Object.assign({}, s));
  }
  for (const s of fin) {
    const id = Number(s.id);
    const existing = map.get(id) || {};
    map.set(id, Object.assign(existing, s));
  }
  return Array.from(map.values());
}

async function getUserAnalytics(userId, query = {}) {
  const filters = {};
  if (query.start_date) filters.start_date = query.start_date;
  if (query.end_date) filters.end_date = query.end_date;
  if (query.service_type) filters.service_type = query.service_type;

  const [ops, fin] = await Promise.all([
    reportsRepository.listOperationalServices(userId, filters),
    reportsRepository.listFinancialServices(userId, filters),
  ]);

  const services = mergeServices(ops, fin);

  const totalServices = services.length;
  const totalHours = services.reduce((sum, s) => sum + Number(s.duration_hours || 0), 0);
  const totalValueExpected = services.reduce((sum, s) => sum + toMoney(s.amount_total), 0);
  const totalValueReceived = services.reduce((sum, s) => sum + toMoney(s.amount_paid), 0);

  const byServiceType = {};
  for (const s of services) {
    const key = s.service_type_key || 'unknown';
    byServiceType[key] = (byServiceType[key] || 0) + 1;
  }

  const topByValue = services
    .filter((s) => Number(s.amount_total))
    .sort((a, b) => Number(b.amount_total || 0) - Number(a.amount_total || 0))
    .slice(0, 5)
    .map((s) => ({ id: s.id, service_type: s.service_type_key, amount_total: toMoney(s.amount_total) }));

  const operationalReport = await reportsService.getOperationalReport(userId, query);
  const financialReport = await reportsService.getFinancialReport(userId, query);

  return {
    summary: {
      total_services: totalServices,
      total_hours: Number(totalHours),
      total_value_expected: toMoney(totalValueExpected),
      total_value_received: toMoney(totalValueReceived),
      average_hours_per_service: totalServices ? Number((totalHours / totalServices).toFixed(2)) : 0,
    },
    by_service_type: byServiceType,
    top_services_by_value: topByValue,
    services: services,
    operational: operationalReport,
    financial: financialReport,
  };
}

module.exports = {
  getUserAnalytics,
};
