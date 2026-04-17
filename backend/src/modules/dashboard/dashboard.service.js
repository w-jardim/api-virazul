const alertsService = require('../alerts/alerts.service');
const alertsRepository = require('../alerts/alerts.repository');
const repository = require('./dashboard.repository');
const { getTimeZoneDayRange, getTimeZoneMonthRange } = require('../alerts/alerts.time');

async function getSummary(userId, now = new Date()) {
  const dayRange = getTimeZoneDayRange(now);
  const monthRange = getTimeZoneMonthRange(now);

  const [todayServices, operationalPending, financialPending, monthlyHours] = await Promise.all([
    repository.getTodayServicesByUser(userId, dayRange.start, dayRange.end),
    repository.countOperationalPendingByUser(userId, now),
    repository.countFinancialPendingByUser(userId, dayRange.start),
    repository.getMonthlyHoursByUser(userId, monthRange.start, monthRange.end),
  ]);

  const today = {
    confirmed: todayServices.filter((item) => item.operational_status !== 'RESERVA'),
    reservations: todayServices.filter((item) => item.operational_status === 'RESERVA'),
  };

  await alertsService.syncUserAlerts(userId, now);
  const alertsActive = await alertsRepository.countActiveAlerts(userId);

  return {
    today,
    counts: {
      alerts_active: alertsActive,
      operational_pending: operationalPending,
      financial_pending: financialPending,
    },
    hours: {
      confirmed: Number(monthlyHours.confirmed_hours || 0),
      waiting: Number(monthlyHours.waiting_hours || 0),
    },
  };
}

module.exports = {
  getSummary,
};
