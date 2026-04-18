const AppError = require('../../utils/app-error');
const repository = require('./services.repository');
const rules = require('./services.rules');
const pricing = require('./services.pricing');
const { toLocalDateKey } = require('../../utils/timezone');

function isAdminMaster(user) {
  return user && user.role === 'ADMIN_MASTER';
}

function assertCanReadService(authUser, service) {
  if (isAdminMaster(authUser)) {
    return;
  }

  if (!service || Number(service.user_id) !== Number(authUser.id)) {
    throw new AppError('FORBIDDEN', 'Acesso negado para este servico.', 403);
  }
}

function assertCanCreateForUser(authUser, targetUserId) {
  if (Number(targetUserId) === Number(authUser.id)) {
    return;
  }

  if (!isAdminMaster(authUser)) {
    throw new AppError('FORBIDDEN', 'Usuario comum nao pode criar servico para outro usuario.', 403);
  }
}

function assertTypeRules(serviceType, operationalStatus, amounts) {
  if (!serviceType) {
    throw new AppError('SERVICE_TYPE_NOT_FOUND', 'Tipo de servico nao encontrado.', 404);
  }

  if (!rules.INITIAL_OPERATIONAL_STATUSES.includes(operationalStatus)) {
    throw new AppError(
      'INVALID_OPERATIONAL_STATUS',
      'Servico deve ser criado inicialmente como TITULAR ou RESERVA.',
      400
    );
  }

  if (serviceType.key === 'ras_compulsory' && operationalStatus === 'RESERVA') {
    throw new AppError(
      'INVALID_OPERATIONAL_STATUS',
      'RAS compulsorio nao permite status RESERVA.',
      400
    );
  }

  if (!serviceType.allows_reservation && operationalStatus === 'RESERVA') {
    throw new AppError(
      'INVALID_OPERATIONAL_STATUS',
      'Este tipo de servico nao permite reserva.',
      400
    );
  }

  if (!serviceType.counts_in_financial) {
    const hasAdditionalFinancial =
      amounts.amount_base !== 0 ||
      amounts.amount_paid !== 0 ||
      amounts.amount_balance !== 0 ||
      amounts.amount_meal !== 0 ||
      amounts.amount_transport !== 0 ||
      amounts.amount_additional !== 0 ||
      amounts.amount_discount !== 0 ||
      amounts.amount_total !== 0;

    if (hasAdditionalFinancial) {
      throw new AppError(
        'INVALID_ORDINARY_FINANCIAL',
        'Escala ordinaria nao aceita valores financeiros adicionais nao-zero.',
        400
      );
    }
  }
}

function assertValidId(id) {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
    throw new AppError('VALIDATION_ERROR', 'id deve ser um inteiro positivo.', 400);
  }
}

function addHours(dateValue, hours) {
  const start = new Date(dateValue);
  return new Date(start.getTime() + Number(hours) * 60 * 60 * 1000);
}

async function assertNoTimeConflict({ userId, startAt, durationHours, excludeServiceId, force }) {
  if (force) {
    return;
  }

  const endAt = addHours(startAt, durationHours);
  const overlaps = await repository.findOverlaps({
    userId,
    startAt,
    endAt,
    excludeServiceId,
  });

  if (overlaps.length > 0) {
    throw new AppError(
      'SCHEDULE_CONFLICT',
      'Ã© preciso intervalo de 8h entre serviÃ§os.',
      409
    );
  }
}

async function assertMinRestInterval({ userId, startAt, durationHours, excludeServiceId }) {
  // This rule is NOT bypassable by `force` â€” it's enforced for user safety.
  const prefs = await repository.getUserPlanningPreferences(userId);
  let minRest = 8; // default 8 hours

  try {
    if (prefs) {
      const parsed = typeof prefs === 'string' ? JSON.parse(prefs) : prefs;
      if (parsed && parsed.min_rest_hours && Number(parsed.min_rest_hours) > 0) {
        minRest = Number(parsed.min_rest_hours);
      }

      // If user disabled the min_rest rule explicitly, skip enforcement
      if (parsed && parsed.min_rest_enabled === false) {
        return;
      }
    }
  } catch (e) {
    // ignore parsing errors and fallback to default
  }

  // Normalize startAt to MySQL DATETIME format for reliable DB comparison
  let dbStartAt = startAt;
  try {
    dbStartAt = new Date(startAt).toISOString().slice(0, 19).replace('T', ' ');
  } catch (e) {
    dbStartAt = startAt;
  }

  // Fetch recent services for the user and find the nearest previous one in JS
  const recent = await repository.list({ userId });
  const newStart = new Date(startAt);
  let previous = null;

  for (const s of recent) {
    if (excludeServiceId && Number(s.id) === Number(excludeServiceId)) continue;
    const sStart = new Date(s.start_at);
    if (sStart < newStart) {
      previous = s;
      break;
    }
  }

  if (!previous) return;

  const prevStart = new Date(previous.start_at);
  const prevEnd = new Date(prevStart.getTime() + Number(previous.duration_hours) * 60 * 60 * 1000);
  const minAllowedStart = new Date(prevEnd.getTime() + Number(minRest) * 60 * 60 * 1000);

  if (newStart < minAllowedStart) {
    throw new AppError(
      'MIN_REST_VIOLATION',
      'Ã© preciso intervalo de 8h entre serviÃ§os.',
      400
    );
  }
}

async function assertMonthlyHoursLimit({ userId, startAt, durationHours, excludeServiceId }) {
  // This rule can be disabled by user preference `monthly_limit_enabled: false`
  const prefs = await repository.getUserPlanningPreferences(userId);
  let limitHours = 120;

  try {
    if (prefs) {
      const parsed = typeof prefs === 'string' ? JSON.parse(prefs) : prefs;
      if (parsed && parsed.monthly_limit_enabled === false) {
        return;
      }
      if (parsed && parsed.monthly_hours_limit && Number(parsed.monthly_hours_limit) > 0) {
        limitHours = Number(parsed.monthly_hours_limit);
      }
    }
  } catch (e) {
    // ignore parsing errors and use default
  }

  // compute month range for startAt
  const startDate = new Date(startAt);
  const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);

  const planningRepo = require('../planning/planning.repository');
  const monthly = await planningRepo.getMonthlyHours(userId, monthStart.toISOString().slice(0, 19).replace('T', ' '), monthEnd.toISOString().slice(0, 19).replace('T', ' '));

  const confirmed = Number(monthly.confirmed_hours || 0);
  const waiting = Number(monthly.waiting_hours || 0);

  // For update, exclude current service's hours if provided
  let currentServiceHours = 0;
  if (excludeServiceId) {
    const existing = await repository.findById(excludeServiceId);
    if (existing) {
      currentServiceHours = Number(existing.duration_hours || 0);
    }
  }

  const usedHours = confirmed + waiting - currentServiceHours;
  const remainingHours = Math.max(limitHours - usedHours, 0);
  const totalAfter = usedHours + Number(durationHours || 0);

  if (totalAfter > limitHours) {
    const { DURATION_ALLOWED } = require('../services/services.rules');
    const feasibleDurations = DURATION_ALLOWED.filter((d) => usedHours + d <= limitHours);
    throw new AppError(
      'MONTHLY_HOURS_LIMIT_VIOLATION',
      `Limite mensal de ${limitHours}h excedido. Restam ${remainingHours}h disponíveis.`,
      400,
      { remaining_hours: remainingHours, feasible_durations: feasibleDurations, limit_hours: limitHours }
    );
  }
}

function parseOptionalPositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('VALIDATION_ERROR', `${fieldName} deve ser um inteiro positivo.`, 400);
  }

  return parsed;
}

async function buildAmountsAndSnapshot(serviceType, payload, existing = null, userId = null) {
  const preview = await pricing.buildFinancialPreview({
    serviceType,
    durationHours: payload.duration_hours,
    manualAmounts: payload,
    rankGroup: payload.rank_group || undefined,
    userId,
    referenceDate: payload.start_at,
  });

  const merged = pricing.applyPreviewToPayload(preview, {
    amount_additional: payload.amount_additional,
    amount_discount: payload.amount_discount,
    amount_paid: payload.amount_paid,
  });

  const amounts = rules.calculateAmounts(merged);
  const financialSnapshot = {
    service_scope: preview.service_scope,
    rank_group: preview.rank_group,
    base_amount: preview.base_amount,
    transport_amount: preview.transport_amount,
    meal_amount: preview.meal_amount,
    total_amount: preview.total_amount,
    source: preview.source,
    calculated_at: new Date().toISOString(),
    previous_snapshot: existing?.financial_snapshot || null,
  };

  return { amounts, financialSnapshot, preview };
}

async function create(authUser, payload) {
  const userId = payload.user_id || authUser.id;
  assertCanCreateForUser(authUser, userId);

  rules.assertValidDuration(payload.duration_hours);
  await assertMinRestInterval({
    userId,
    startAt: payload.start_at,
    durationHours: payload.duration_hours,
    excludeServiceId: null,
  });

  await assertMonthlyHoursLimit({
    userId,
    startAt: payload.start_at,
    durationHours: payload.duration_hours,
    excludeServiceId: null,
  });

  await assertNoTimeConflict({
    userId,
    startAt: payload.start_at,
    durationHours: payload.duration_hours,
    force: payload.force,
  });

  const serviceType = await repository.findServiceTypeById(payload.service_type_id);
  const operationalStatus = payload.operational_status || 'TITULAR';
  const financialStatus = payload.financial_status || 'PREVISTO';
  const { amounts, financialSnapshot } = await buildAmountsAndSnapshot(serviceType, payload, null, userId);

  assertTypeRules(serviceType, operationalStatus, amounts);
  rules.assertFinancialCompatibilityWithOperational(operationalStatus, financialStatus);
  rules.assertFinancialRules(financialStatus, amounts);

  const created = await repository.createService({
    user_id: userId,
    service_type_id: payload.service_type_id,
    start_at: payload.start_at,
    duration_hours: payload.duration_hours,
    operational_status: operationalStatus,
    reservation_expires_at: payload.reservation_expires_at || null,
    notes: payload.notes || null,
    financial_status: financialStatus,
    amount_base: amounts.amount_base,
    amount_paid: amounts.amount_paid,
    amount_balance: amounts.amount_balance,
    amount_meal: amounts.amount_meal,
    amount_transport: amounts.amount_transport,
    amount_additional: amounts.amount_additional,
    amount_discount: amounts.amount_discount,
    amount_total: amounts.amount_total,
    financial_snapshot: financialSnapshot,
    payment_due_date: payload.payment_due_date || null,
    payment_at: null,
    is_complementary: Boolean(serviceType.counts_in_financial),
    created_by: authUser.id,
  });

  return created;
}

async function previewFinancial(authUser, payload) {
  const serviceType = await repository.findServiceTypeById(payload.service_type_id);
  if (!serviceType) {
    throw new AppError('SERVICE_TYPE_NOT_FOUND', 'Tipo de servico nao encontrado.', 404);
  }

  const preview = await pricing.buildFinancialPreview({
    serviceType,
    durationHours: payload.duration_hours,
    manualAmounts: payload,
  });

  return preview;
}

async function list(authUser, query) {
  const queryUserId = parseOptionalPositiveInt(query.user_id, 'query.user_id');
  const queryServiceTypeId = parseOptionalPositiveInt(
    query.service_type_id,
    'query.service_type_id'
  );

  if (queryUserId && !isAdminMaster(authUser) && queryUserId !== Number(authUser.id)) {
    throw new AppError('FORBIDDEN', 'Usuario comum nao pode listar servicos de outro usuario.', 403);
  }

  const filters = {
    userId: isAdminMaster(authUser) ? queryUserId : authUser.id,
    serviceTypeId: queryServiceTypeId,
  };

  return repository.list(filters);
}

async function getDateRange(authUser, query = {}) {
  const queryUserId = parseOptionalPositiveInt(query.user_id, 'query.user_id');

  if (queryUserId && !isAdminMaster(authUser) && queryUserId !== Number(authUser.id)) {
    throw new AppError('FORBIDDEN', 'Usuario comum nao pode listar servicos de outro usuario.', 403);
  }

  const filters = {
    userId: isAdminMaster(authUser) ? queryUserId : authUser.id,
  };

  const range = await repository.getDateRange(filters);
  return {
    start_date: range?.start_date || null,
    end_date: range?.end_date || null,
  };
}
async function getById(authUser, id) {
  assertValidId(id);

  const service = await repository.findById(id);
  if (!service || service.deleted_at) {
    throw new AppError('SERVICE_NOT_FOUND', 'Servico nao encontrado.', 404);
  }

  assertCanReadService(authUser, service);
  return service;
}

async function update(authUser, id, payload) {
  assertValidId(id);

  const existing = await repository.findById(id);

  if (!existing || existing.deleted_at) {
    throw new AppError('SERVICE_NOT_FOUND', 'Servico nao encontrado.', 404);
  }

  assertCanReadService(authUser, existing);

  const serviceTypeId = payload.service_type_id || existing.service_type_id;
  const serviceType = await repository.findServiceTypeById(serviceTypeId);
  const operationalStatus = existing.operational_status;
  const financialStatus = existing.financial_status;
  const nextStartAt = payload.start_at || existing.start_at;
  const nextDurationHours = payload.duration_hours ?? existing.duration_hours;

  rules.assertValidDuration(nextDurationHours);
  await assertMinRestInterval({
    userId: existing.user_id,
    startAt: nextStartAt,
    durationHours: nextDurationHours,
    excludeServiceId: id,
  });

    await assertMonthlyHoursLimit({
      userId: existing.user_id,
      startAt: nextStartAt,
      durationHours: nextDurationHours,
      excludeServiceId: id,
    });

  await assertNoTimeConflict({
    userId: existing.user_id,
    startAt: nextStartAt,
    durationHours: nextDurationHours,
    excludeServiceId: id,
    force: payload.force,
  });

  const { amounts, financialSnapshot } = await buildAmountsAndSnapshot(
    serviceType,
    {
      ...existing,
      ...payload,
      start_at: nextStartAt,
      duration_hours: nextDurationHours,
      amount_paid: payload.amount_paid ?? existing.amount_paid,
      amount_additional: payload.amount_additional ?? existing.amount_additional,
      amount_discount: payload.amount_discount ?? existing.amount_discount,
    },
    existing,
    existing.user_id
  );

  assertTypeRules(serviceType, operationalStatus, amounts);
  rules.assertFinancialCompatibilityWithOperational(operationalStatus, financialStatus);
  rules.assertFinancialRules(financialStatus, amounts);

  return repository.updateService(id, {
    service_type_id: serviceTypeId,
    start_at: nextStartAt,
    duration_hours: nextDurationHours,
    reservation_expires_at:
      Object.prototype.hasOwnProperty.call(payload, 'reservation_expires_at')
        ? payload.reservation_expires_at
        : existing.reservation_expires_at,
    notes: Object.prototype.hasOwnProperty.call(payload, 'notes') ? payload.notes : existing.notes,
    amount_base: amounts.amount_base,
    amount_paid: amounts.amount_paid,
    amount_balance: amounts.amount_balance,
    amount_meal: amounts.amount_meal,
    amount_transport: amounts.amount_transport,
    amount_additional: amounts.amount_additional,
    amount_discount: amounts.amount_discount,
    amount_total: amounts.amount_total,
    financial_snapshot: financialSnapshot,
    payment_due_date:
      Object.prototype.hasOwnProperty.call(payload, 'payment_due_date')
        ? payload.payment_due_date
        : existing.payment_due_date,
    is_complementary: Boolean(serviceType.counts_in_financial),
  });
}

async function transition(authUser, id, payload) {
  assertValidId(id);

  const existing = await repository.findById(id);

  if (!existing || existing.deleted_at) {
    throw new AppError('SERVICE_NOT_FOUND', 'Servico nao encontrado.', 404);
  }

  assertCanReadService(authUser, existing);

  let targetOperationalStatus = payload.target_operational_status || existing.operational_status;
  let targetFinancialStatus = payload.target_financial_status || existing.financial_status;

  rules.assertOperationalTransition(existing.operational_status, targetOperationalStatus);

  const amounts = rules.calculateAmounts({
    amount_base: existing.amount_base,
    amount_paid: existing.amount_paid,
    amount_meal: existing.amount_meal,
    amount_transport: existing.amount_transport,
    amount_additional: existing.amount_additional,
    amount_discount: existing.amount_discount,
  });

  let performedAt = existing.performed_at;
  let paymentAt = existing.payment_at;
  let amountPaid = amounts.amount_paid;
  let amountBalance = amounts.amount_balance;

  if (targetOperationalStatus === 'REALIZADO') {
    performedAt = new Date();

    const ruleBEnabled = await repository.getUserPreferenceRuleB(existing.user_id);

    if (ruleBEnabled) {
      targetFinancialStatus = 'PAGO';
      paymentAt = performedAt;
      amountPaid = amounts.amount_total;
      amountBalance = 0;
    } else {
      targetFinancialStatus = 'PREVISTO';
      paymentAt = null;
    }
  }

  const transitionAmounts = {
    ...amounts,
    amount_paid: Number(amountPaid),
    amount_balance: Number(amountBalance),
  };

  rules.assertFinancialCompatibilityWithOperational(targetOperationalStatus, targetFinancialStatus);
  rules.assertFinancialRules(targetFinancialStatus, transitionAmounts);

  if (
    targetOperationalStatus === existing.operational_status &&
    targetFinancialStatus === existing.financial_status
  ) {
    throw new AppError('NO_STATUS_CHANGE', 'Nao houve alteracao de status.', 400);
  }

  const connection = await repository.getConnection();

  try {
    await connection.beginTransaction();

    const current = await repository.findByIdForUpdate(connection, id);
    if (!current) {
      throw new AppError('SERVICE_NOT_FOUND', 'Servico nao encontrado.', 404);
    }

    await repository.applyTransition(connection, id, {
      operational_status: targetOperationalStatus,
      financial_status: targetFinancialStatus,
      performed_at: performedAt,
      payment_at: paymentAt,
      amount_paid: amountPaid,
      amount_balance: amountBalance,
    });

    await repository.createStatusHistory(connection, {
      service_id: id,
      previous_operational_status: current.operational_status,
      previous_financial_status: current.financial_status,
      new_operational_status: targetOperationalStatus,
      new_financial_status: targetFinancialStatus,
      transition_type: payload.transition_type,
      changed_by: authUser.id,
      reason: payload.reason || null,
    });

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return repository.findById(id);
}

async function confirmPayment(authUser, id, payload = {}) {
  assertValidId(id);

  const existing = await repository.findById(id);
  if (!existing || existing.deleted_at) {
    throw new AppError('SERVICE_NOT_FOUND', 'Servico nao encontrado.', 404);
  }

  assertCanReadService(authUser, existing);

  if (existing.financial_status === 'PAGO') {
    return existing;
  }

  const connection = await repository.getConnection();
  const paymentAt = payload.payment_at ? new Date(payload.payment_at) : new Date();

  try {
    await connection.beginTransaction();

    const current = await repository.findByIdForUpdate(connection, id);
    if (!current) {
      throw new AppError('SERVICE_NOT_FOUND', 'Servico nao encontrado.', 404);
    }

    await repository.applyTransition(connection, id, {
      operational_status: current.operational_status,
      financial_status: 'PAGO',
      performed_at: current.performed_at,
      payment_at: paymentAt,
      amount_paid: current.amount_total,
      amount_balance: 0,
    });

    await repository.createStatusHistory(connection, {
      service_id: id,
      previous_operational_status: current.operational_status,
      previous_financial_status: current.financial_status,
      new_operational_status: current.operational_status,
      new_financial_status: 'PAGO',
      transition_type: 'CONFIRMAR_PAGAMENTO',
      changed_by: authUser.id,
      reason: payload.reason || null,
    });

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return repository.findById(id);
}

async function promoteReservation(authUser, id, payload = {}) {
  return transition(authUser, id, {
    transition_type: 'RESERVA_PARA_CONVERTIDO',
    target_operational_status: 'CONVERTIDO_TITULAR',
    reason: payload.reason || null,
  });
}

async function syncFinancialStatusByCalendar(referenceDate = new Date()) {
  const dateKey = toLocalDateKey(referenceDate);
  const pendingUpdated = await repository.syncPendingFinancialStatuses(dateKey);
  const overdueUpdated = await repository.syncOverdueFinancialStatuses(dateKey);

  return {
    date: dateKey,
    pending_updated: pendingUpdated,
    overdue_updated: overdueUpdated,
  };
}

async function remove(authUser, id) {
  assertValidId(id);

  const existing = await repository.findById(id);

  if (!existing || existing.deleted_at) {
    throw new AppError('SERVICE_NOT_FOUND', 'Servico nao encontrado.', 404);
  }

  assertCanReadService(authUser, existing);

  const deleted = await repository.softDelete(id);
  if (!deleted) {
    throw new AppError('SERVICE_NOT_FOUND', 'Servico nao encontrado.', 404);
  }
}

module.exports = {
  create,
  previewFinancial,
  list,
  getDateRange,
  getById,
  update,
  transition,
  confirmPayment,
  promoteReservation,
  syncFinancialStatusByCalendar,
  remove,
};
