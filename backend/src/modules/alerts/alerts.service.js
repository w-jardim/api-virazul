const AppError = require('../../utils/app-error');
const repository = require('./alerts.repository');
const {
  getTimeZoneDayRange,
  toDateKeyInTimeZone,
} = require('./alerts.time');

const ALERT_TYPE_DAY = 'DAY';
const ALERT_TYPE_OPERATIONAL = 'OPERATIONAL';
const ALERT_TYPE_FINANCIAL = 'FINANCIAL';

const OPERATIONAL_FINAL_STATUSES = ['REALIZADO', 'FALTOU', 'CANCELADO', 'NAO_CONVERTIDO'];

function isDayAlertService(service, now = new Date()) {
  return toDateKeyInTimeZone(service.start_at) === toDateKeyInTimeZone(now);
}

function isOperationalPendingService(service, now = new Date()) {
  return (
    new Date(service.start_at) < now &&
    !OPERATIONAL_FINAL_STATUSES.includes(service.operational_status)
  );
}

function isFinancialPendingService(service, now = new Date()) {
  if (service.operational_status !== 'REALIZADO') {
    return false;
  }

  if (!['PREVISTO', 'NAO_PAGO'].includes(service.financial_status)) {
    return false;
  }

  if (!service.payment_due_date) {
    return false;
  }

  const todayKey = toDateKeyInTimeZone(now);
  const dueKey = toDateKeyInTimeZone(service.payment_due_date);

  return dueKey < todayKey;
}

function buildAlertPayload(type, service) {
  return {
    service_id: service.id,
    service_type_id: service.service_type_id,
    service_type_key: service.service_type_key,
    service_type_name: service.service_type_name,
    start_at: service.start_at,
    operational_status: service.operational_status,
    financial_status: service.financial_status,
    duration_hours: service.duration_hours,
    alert_context: type,
  };
}

function buildDedupeKey(userId, alertType, service, now = new Date()) {
  if (alertType === ALERT_TYPE_DAY) {
    return `u:${userId}|t:${alertType}|s:${service.id}|r:${toDateKeyInTimeZone(now)}`;
  }

  if (alertType === ALERT_TYPE_FINANCIAL) {
    const due = service.payment_due_date ? toDateKeyInTimeZone(service.payment_due_date) : 'none';
    return `u:${userId}|t:${alertType}|s:${service.id}|r:${due}`;
  }

  return `u:${userId}|t:${alertType}|s:${service.id}|r:${toDateKeyInTimeZone(service.start_at)}`;
}

/**
 * MVP policy:
 * - ACTIVE alerts that became invalid are soft-deleted during sync.
 * - READ and DISMISSED alerts are kept as history (no cron cleanup in this phase).
 */
async function syncUserAlerts(userId, now = new Date()) {
  const dayRange = getTimeZoneDayRange(now);

  const [todayServices, operationalPendingServices, financialPendingServices] = await Promise.all([
    repository.getTodayServices(userId, dayRange.start, dayRange.end),
    repository.getOperationalPendingServices(userId, now),
    repository.getFinancialPendingServices(userId, dayRange.start),
  ]);

  const candidates = [];

  for (const service of todayServices) {
    if (isDayAlertService(service, now)) {
      candidates.push({
        user_id: userId,
        alert_type: ALERT_TYPE_DAY,
        related_service_id: service.id,
        dedupe_key: buildDedupeKey(userId, ALERT_TYPE_DAY, service, now),
        payload: buildAlertPayload(ALERT_TYPE_DAY, service),
      });
    }
  }

  for (const service of operationalPendingServices) {
    if (isOperationalPendingService(service, now)) {
      candidates.push({
        user_id: userId,
        alert_type: ALERT_TYPE_OPERATIONAL,
        related_service_id: service.id,
        dedupe_key: buildDedupeKey(userId, ALERT_TYPE_OPERATIONAL, service, now),
        payload: buildAlertPayload(ALERT_TYPE_OPERATIONAL, service),
      });
    }
  }

  for (const service of financialPendingServices) {
    if (isFinancialPendingService(service, now)) {
      candidates.push({
        user_id: userId,
        alert_type: ALERT_TYPE_FINANCIAL,
        related_service_id: service.id,
        dedupe_key: buildDedupeKey(userId, ALERT_TYPE_FINANCIAL, service, now),
        payload: buildAlertPayload(ALERT_TYPE_FINANCIAL, service),
      });
    }
  }

  const requiredKeys = new Set(candidates.map((item) => item.dedupe_key));
  const existing = await repository.getAlertsByDedupeKeys(userId, Array.from(requiredKeys));
  const existingKeys = new Set(existing.map((item) => item.dedupe_key));

  const missingCandidates = candidates.filter((item) => !existingKeys.has(item.dedupe_key));
  await repository.insertAlertsBatch(missingCandidates);

  const activeGenerated = await repository.listActiveGeneratedAlerts(userId);
  const obsoleteIds = activeGenerated
    .filter((alert) => !requiredKeys.has(alert.dedupe_key))
    .map((alert) => alert.id);

  await repository.softDeleteByIds(obsoleteIds);
}

async function list(userId, filters) {
  await syncUserAlerts(userId);
  return repository.listByUser(userId, filters);
}

async function markRead(userId, alertId) {
  const alert = await repository.findByIdAndUser(alertId, userId);

  if (!alert) {
    throw new AppError('ALERT_NOT_FOUND', 'Alerta nao encontrado.', 404);
  }

  return repository.markStatus(alertId, userId, 'READ');
}

async function dismiss(userId, alertId) {
  const alert = await repository.findByIdAndUser(alertId, userId);

  if (!alert) {
    throw new AppError('ALERT_NOT_FOUND', 'Alerta nao encontrado.', 404);
  }

  return repository.markStatus(alertId, userId, 'DISMISSED');
}

module.exports = {
  ALERT_TYPE_DAY,
  ALERT_TYPE_OPERATIONAL,
  ALERT_TYPE_FINANCIAL,
  isDayAlertService,
  isOperationalPendingService,
  isFinancialPendingService,
  buildDedupeKey,
  syncUserAlerts,
  list,
  markRead,
  dismiss,
};
