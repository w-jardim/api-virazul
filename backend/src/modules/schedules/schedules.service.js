const AppError = require('../../utils/app-error');
const { assertValidDuration } = require('../services/services.rules');
const repository = require('./schedules.repository');
const { addHours, generateRecurringStartDates } = require('./schedules.rules');

function isAdminMaster(user) {
  return user && user.role === 'ADMIN_MASTER';
}

function assertCanCreateForUser(authUser, targetUserId) {
  if (Number(targetUserId) === Number(authUser.id)) {
    return;
  }

  if (!isAdminMaster(authUser)) {
    throw new AppError('FORBIDDEN', 'Usuario comum nao pode criar escala para outro usuario.', 403);
  }
}

async function assertNoConflict({ userId, startAt, durationHours, force }) {
  if (force) {
    return;
  }

  const overlaps = await repository.findOverlaps({
    userId,
    startAt,
    endAt: addHours(startAt, durationHours),
  });

  if (overlaps.length > 0) {
    throw new AppError(
      'SCHEDULE_CONFLICT',
      'é preciso intervalo de 8h entre serviços.',
      409
    );
  }
}

function buildOccurrences(payload) {
  if (!payload.recurrence) {
    return [new Date(payload.start_at)];
  }

  return generateRecurringStartDates({
    startAt: payload.start_at,
    weekdays: payload.recurrence.weekdays,
    periodDays: payload.recurrence.period_days,
  });
}

async function create(authUser, payload) {
  const userId = payload.user_id || authUser.id;
  assertCanCreateForUser(authUser, userId);
  assertValidDuration(payload.duration_hours);

  const ordinaryType = await repository.findOrdinaryServiceType();
  if (!ordinaryType) {
    throw new AppError(
      'ORDINARY_SERVICE_TYPE_NOT_FOUND',
      'Tipo de servico ORDINARY nao encontrado.',
      404
    );
  }

  const starts = buildOccurrences(payload);
  if (starts.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Recorrencia nao gerou datas validas.', 400);
  }

  for (const startAt of starts) {
    await assertNoConflict({
      userId,
      startAt,
      durationHours: payload.duration_hours,
      force: payload.force,
    });
  }

  const connection = await repository.getConnection();
  const createdIds = [];

  try {
    await connection.beginTransaction();

    for (const startAt of starts) {
      const serviceId = await repository.createService(connection, {
        user_id: userId,
        service_type_id: ordinaryType.id,
        start_at: startAt,
        duration_hours: payload.duration_hours,
        operational_status: 'TITULAR',
        reservation_expires_at: null,
        notes: payload.notes || null,
        financial_status: 'PREVISTO',
        amount_base: 0,
        amount_paid: 0,
        amount_balance: 0,
        amount_meal: 0,
        amount_transport: 0,
        amount_additional: 0,
        amount_discount: 0,
        amount_total: 0,
        payment_due_date: null,
        payment_at: null,
        is_complementary: false,
        created_by: authUser.id,
      });

      createdIds.push(serviceId);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const items = await repository.findByIds(createdIds);

  return {
    created_count: items.length,
    items,
  };
}

// ── template CRUD + calendar ──────────────────────────────────────────────────

const { computeWorkDays } = require('./schedules.template');

async function getTemplate(userId) {
  const template = await repository.getScheduleTemplate(userId);
  return { template: template || null };
}

async function saveTemplate(userId, templatePayload) {
  const saved = await repository.saveScheduleTemplate(userId, templatePayload);
  return { template: saved };
}

async function deleteTemplate(userId) {
  await repository.deleteScheduleTemplate(userId);
  return { template: null };
}

async function getCalendar(userId, month) {
  const template = await repository.getScheduleTemplate(userId);
  const work_days = computeWorkDays(template, month);
  return { month, template: template || null, work_days };
}

module.exports = {
  create,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  getCalendar,
};
