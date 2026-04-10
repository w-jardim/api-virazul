const AppError = require('../../utils/app-error');
const repository = require('./services.repository');
const rules = require('./services.rules');

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
      'Existe conflito de horario com outro servico/escala. Use force=true para confirmar.',
      409
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

async function create(authUser, payload) {
  const userId = payload.user_id || authUser.id;
  assertCanCreateForUser(authUser, userId);

  rules.assertValidDuration(payload.duration_hours);
  await assertNoTimeConflict({
    userId,
    startAt: payload.start_at,
    durationHours: payload.duration_hours,
    force: payload.force,
  });

  const serviceType = await repository.findServiceTypeById(payload.service_type_id);
  const operationalStatus = payload.operational_status || 'AGENDADO';
  const financialStatus = payload.financial_status || 'PREVISTO';
  const amounts = rules.calculateAmounts(payload);

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
    payment_due_date: payload.payment_due_date || null,
    payment_at: null,
    is_complementary: Boolean(serviceType.counts_in_financial),
    created_by: authUser.id,
  });

  return created;
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

  const merged = {
    amount_base: payload.amount_base ?? existing.amount_base,
    amount_paid: payload.amount_paid ?? existing.amount_paid,
    amount_meal: payload.amount_meal ?? existing.amount_meal,
    amount_transport: payload.amount_transport ?? existing.amount_transport,
    amount_additional: payload.amount_additional ?? existing.amount_additional,
    amount_discount: payload.amount_discount ?? existing.amount_discount,
  };

  const amounts = rules.calculateAmounts(merged);
  const operationalStatus = existing.operational_status;
  const financialStatus = existing.financial_status;
  const nextStartAt = payload.start_at || existing.start_at;
  const nextDurationHours = payload.duration_hours ?? existing.duration_hours;

  rules.assertValidDuration(nextDurationHours);
  await assertNoTimeConflict({
    userId: existing.user_id,
    startAt: nextStartAt,
    durationHours: nextDurationHours,
    excludeServiceId: id,
    force: payload.force,
  });
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
  list,
  getById,
  update,
  transition,
  remove,
};
