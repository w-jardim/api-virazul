const { pool } = require('../../config/db');

async function findServiceTypeById(id) {
  const [rows] = await pool.query(
    `SELECT id, \`key\`, name, category, allows_reservation, requires_manual_value,
            counts_in_financial, shows_in_agenda, accounting_rules
       FROM service_types
      WHERE id = ?
      LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function getUserPreferenceRuleB(userId) {
  const [rows] = await pool.query(
    `SELECT rule_b_enabled
       FROM user_preferences
      WHERE user_id = ?
      LIMIT 1`,
    [userId]
  );

  return rows[0] ? Boolean(rows[0].rule_b_enabled) : false;
}

async function findActiveBasePricing(rankGroup, durationHours, referenceDate = null) {
  const [rows] = await pool.query(
    `SELECT rank_group, duration_hours, base_amount, effective_start_date, effective_end_date, is_active
       FROM pricing_base_values
      WHERE rank_group = ?
        AND duration_hours = ?
        AND is_active = 1
        AND effective_start_date <= COALESCE(?, CURRENT_DATE())
        AND (effective_end_date IS NULL OR effective_end_date >= COALESCE(?, CURRENT_DATE()))
      ORDER BY effective_start_date DESC, id DESC
      LIMIT 1`,
    [rankGroup, durationHours, referenceDate, referenceDate]
  );

  return rows[0] || null;
}

async function findActiveFinancialRule(serviceScope, referenceDate = null) {
  const [rows] = await pool.query(
    `SELECT service_scope, allow_transport, transport_amount, allow_meal, meal_amount,
            effective_start_date, effective_end_date, is_active
       FROM service_type_financial_rules
      WHERE service_scope = ?
        AND is_active = 1
        AND effective_start_date <= COALESCE(?, CURRENT_DATE())
        AND (effective_end_date IS NULL OR effective_end_date >= COALESCE(?, CURRENT_DATE()))
      ORDER BY effective_start_date DESC, id DESC
      LIMIT 1`,
    [serviceScope, referenceDate, referenceDate]
  );

  return rows[0] || null;
}

async function createService(payload) {
  const [result] = await pool.query(
    `INSERT INTO services (
      user_id,
      service_type_id,
      start_at,
      duration_hours,
      operational_status,
      reservation_expires_at,
      notes,
      financial_status,
      amount_base,
      amount_paid,
      amount_balance,
      amount_meal,
      amount_transport,
      amount_additional,
      amount_discount,
      amount_total,
      financial_snapshot,
      payment_due_date,
      payment_at,
      is_complementary,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?)` ,
    [
      payload.user_id,
      payload.service_type_id,
      payload.start_at,
      payload.duration_hours,
      payload.operational_status,
      payload.reservation_expires_at,
      payload.notes,
      payload.financial_status,
      payload.amount_base,
      payload.amount_paid,
      payload.amount_balance,
      payload.amount_meal,
      payload.amount_transport,
      payload.amount_additional,
      payload.amount_discount,
      payload.amount_total,
      JSON.stringify(payload.financial_snapshot || null),
      payload.payment_due_date,
      payload.payment_at,
      Number(payload.is_complementary),
      payload.created_by,
    ]
  );

  return findById(result.insertId);
}

function buildListQuery(filters) {
  const where = ['s.deleted_at IS NULL'];
  const params = [];

  if (filters.userId) {
    where.push('s.user_id = ?');
    params.push(filters.userId);
  }

  if (filters.serviceTypeId) {
    where.push('s.service_type_id = ?');
    params.push(filters.serviceTypeId);
  }

  const sql = `
    SELECT s.*, st.\`key\` AS service_type_key, st.name AS service_type_name, st.category AS service_type_category,
           st.allows_reservation, st.counts_in_financial, st.accounting_rules
      FROM services s
      JOIN service_types st ON st.id = s.service_type_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.start_at DESC, s.id DESC`;

  return { sql, params };
}

async function list(filters) {
  const { sql, params } = buildListQuery(filters);
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function getDateRange(filters = {}) {
  const where = ['deleted_at IS NULL'];
  const params = [];

  if (filters.userId) {
    where.push('user_id = ?');
    params.push(filters.userId);
  }

  const [rows] = await pool.query(
    `SELECT
       DATE_FORMAT(MIN(start_at), '%Y-%m-%d') AS start_date,
       DATE_FORMAT(MAX(start_at), '%Y-%m-%d') AS end_date
     FROM services
     WHERE ${where.join(' AND ')}`,
    params
  );

  return rows[0] || { start_date: null, end_date: null };
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT s.*, st.\`key\` AS service_type_key, st.name AS service_type_name, st.category AS service_type_category,
            st.allows_reservation, st.counts_in_financial, st.accounting_rules
       FROM services s
       JOIN service_types st ON st.id = s.service_type_id
      WHERE s.id = ?
      LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function updateService(id, payload) {
  await pool.query(
    `UPDATE services
        SET service_type_id = ?,
            start_at = ?,
            duration_hours = ?,
            reservation_expires_at = ?,
            notes = ?,
            amount_base = ?,
            amount_paid = ?,
            amount_balance = ?,
            amount_meal = ?,
            amount_transport = ?,
            amount_additional = ?,
            amount_discount = ?,
            amount_total = ?,
            financial_snapshot = CAST(? AS JSON),
            payment_due_date = ?,
            is_complementary = ?,
            version = version + 1
      WHERE id = ?
        AND deleted_at IS NULL`,
    [
      payload.service_type_id,
      payload.start_at,
      payload.duration_hours,
      payload.reservation_expires_at,
      payload.notes,
      payload.amount_base,
      payload.amount_paid,
      payload.amount_balance,
      payload.amount_meal,
      payload.amount_transport,
      payload.amount_additional,
      payload.amount_discount,
      payload.amount_total,
      JSON.stringify(payload.financial_snapshot || null),
      payload.payment_due_date,
      Number(payload.is_complementary),
      id,
    ]
  );

  return findById(id);
}

async function softDelete(id) {
  const [result] = await pool.query(
    `UPDATE services
        SET deleted_at = CURRENT_TIMESTAMP,
            version = version + 1
      WHERE id = ?
        AND deleted_at IS NULL`,
    [id]
  );

  return result.affectedRows > 0;
}

async function getConnection() {
  return pool.getConnection();
}

async function findByIdForUpdate(connection, id) {
  const [rows] = await connection.query(
    `SELECT *
       FROM services
      WHERE id = ?
        AND deleted_at IS NULL
      FOR UPDATE`,
    [id]
  );

  return rows[0] || null;
}

async function applyTransition(connection, id, transition) {
  await connection.query(
    `UPDATE services
        SET operational_status = ?,
            financial_status = ?,
            performed_at = ?,
            payment_at = ?,
            amount_paid = ?,
            amount_balance = ?,
            version = version + 1
      WHERE id = ?`,
    [
      transition.operational_status,
      transition.financial_status,
      transition.performed_at,
      transition.payment_at,
      transition.amount_paid,
      transition.amount_balance,
      id,
    ]
  );
}

async function createStatusHistory(connection, payload) {
  await connection.query(
    `INSERT INTO service_status_history (
      service_id,
      previous_operational_status,
      previous_financial_status,
      new_operational_status,
      new_financial_status,
      transition_type,
      changed_by,
      reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      payload.service_id,
      payload.previous_operational_status,
      payload.previous_financial_status,
      payload.new_operational_status,
      payload.new_financial_status,
      payload.transition_type,
      payload.changed_by,
      payload.reason,
    ]
  );
}

async function syncPendingFinancialStatuses(referenceDate) {
  const [result] = await pool.query(
    `UPDATE services
        SET financial_status = 'PENDENTE',
            version = version + 1
      WHERE deleted_at IS NULL
        AND payment_due_date IS NOT NULL
        AND financial_status IN ('PREVISTO')
        AND payment_due_date = DATE(?)`,
    [referenceDate]
  );

  return result.affectedRows || 0;
}

async function syncOverdueFinancialStatuses(referenceDate) {
  const [result] = await pool.query(
    `UPDATE services
        SET financial_status = 'EM_ATRASO',
            version = version + 1
      WHERE deleted_at IS NULL
        AND payment_due_date IS NOT NULL
        AND financial_status IN ('PREVISTO', 'PENDENTE')
        AND payment_due_date < DATE(?)`,
    [referenceDate]
  );

  return result.affectedRows || 0;
}

function buildOverlapQuery(params) {
  const where = [
    's.user_id = ?',
    's.deleted_at IS NULL',
    's.start_at < ?',
    'DATE_ADD(s.start_at, INTERVAL s.duration_hours HOUR) > ?',
  ];
  const queryParams = [params.userId, params.endAt, params.startAt];

  if (params.excludeServiceId) {
    where.push('s.id <> ?');
    queryParams.push(params.excludeServiceId);
  }

  const sql = `
    SELECT s.id, s.start_at, s.duration_hours, s.operational_status,
           st.\`key\` AS service_type_key, st.name AS service_type_name
      FROM services s
      JOIN service_types st ON st.id = s.service_type_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.start_at ASC, s.id ASC
     LIMIT 20`;

  return { sql, queryParams };
}

async function findOverlaps({ userId, startAt, endAt, excludeServiceId }) {
  const { sql, queryParams } = buildOverlapQuery({
    userId,
    startAt,
    endAt,
    excludeServiceId,
  });

  const [rows] = await pool.query(sql, queryParams);
  return rows;
}

async function findPreviousService({ userId, startAt, excludeServiceId = null }) {
  const where = [
    's.user_id = ?',
    's.deleted_at IS NULL',
    's.start_at < ?',
  ];
  const params = [userId, startAt];

  if (excludeServiceId) {
    where.push('s.id <> ?');
    params.push(excludeServiceId);
  }

  const sql = `
    SELECT s.id, s.start_at, s.duration_hours, s.operational_status,
           st.` + "`key`" + ` AS service_type_key, st.name AS service_type_name
      FROM services s
      JOIN service_types st ON st.id = s.service_type_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.start_at DESC, s.id DESC
     LIMIT 1`;

  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function getUserPlanningPreferences(userId) {
  const [rows] = await pool.query(
    `SELECT planning_preferences
       FROM user_preferences
      WHERE user_id = ?
      LIMIT 1`,
    [userId]
  );

  return rows[0] ? rows[0].planning_preferences : null;
}

module.exports = {
  findServiceTypeById,
  getUserPreferenceRuleB,
  findActiveBasePricing,
  findActiveFinancialRule,
  createService,
  list,
  getDateRange,
  findById,
  updateService,
  softDelete,
  getConnection,
  findByIdForUpdate,
  applyTransition,
  createStatusHistory,
  syncPendingFinancialStatuses,
  syncOverdueFinancialStatuses,
  findOverlaps,
  findPreviousService,
  getUserPlanningPreferences,
};
