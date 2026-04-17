const { pool } = require('../../config/db');

function buildBaseWhere(userId, filters, params) {
  const where = ['s.user_id = ?', 's.deleted_at IS NULL'];
  params.push(userId);

  if (filters.startAt) {
    where.push('s.start_at >= ?');
    params.push(filters.startAt);
  }

  if (filters.endAt) {
    where.push('s.start_at < ?');
    params.push(filters.endAt);
  }

  if (filters.serviceType) {
    where.push('st.`key` = ?');
    params.push(filters.serviceType);
  }

  return where;
}

async function listOperationalServices(userId, filters = {}) {
  const params = [];
  const where = buildBaseWhere(userId, filters, params);

  if (filters.operationalStatus) {
    where.push('s.operational_status = ?');
    params.push(filters.operationalStatus);
  }

  const [rows] = await pool.query(
    `SELECT
       s.id,
       s.start_at,
       s.duration_hours,
       s.operational_status,
       st.\`key\` AS service_type_key
     FROM services s
     JOIN service_types st ON st.id = s.service_type_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.start_at ASC, s.id ASC`,
    params
  );

  return rows;
}

async function listReservationTransitions(userId, filters = {}) {
  const params = [userId];
  const where = [
    's.user_id = ?',
    's.deleted_at IS NULL',
    "h.previous_operational_status = 'RESERVA'",
    "h.new_operational_status IN ('CONVERTIDO_TITULAR', 'NAO_CONVERTIDO')",
  ];

  if (filters.startAt) {
    where.push('s.start_at >= ?');
    params.push(filters.startAt);
  }

  if (filters.endAt) {
    where.push('s.start_at < ?');
    params.push(filters.endAt);
  }

  if (filters.serviceType) {
    where.push('st.`key` = ?');
    params.push(filters.serviceType);
  }

  const [rows] = await pool.query(
    `SELECT
       h.service_id,
       h.new_operational_status
     FROM service_status_history h
     JOIN services s ON s.id = h.service_id
     JOIN service_types st ON st.id = s.service_type_id
     WHERE ${where.join(' AND ')}`,
    params
  );

  return rows;
}

async function listFinancialServices(userId, filters = {}) {
  const params = [];
  const where = buildBaseWhere(userId, filters, params);

  if (filters.financialStatus) {
    where.push('s.financial_status = ?');
    params.push(filters.financialStatus);
  }

  const [rows] = await pool.query(
    `SELECT
       s.id,
       s.start_at,
       s.operational_status,
       s.financial_status,
       s.amount_total,
       s.amount_paid,
       s.amount_balance,
       CAST(s.payment_due_date AS CHAR) AS payment_due_date,
       st.\`key\` AS service_type_key,
       st.category AS service_type_category,
       st.counts_in_financial
     FROM services s
     JOIN service_types st ON st.id = s.service_type_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.start_at ASC, s.id ASC`,
    params
  );

  return rows;
}

module.exports = {
  listOperationalServices,
  listReservationTransitions,
  listFinancialServices,
};
