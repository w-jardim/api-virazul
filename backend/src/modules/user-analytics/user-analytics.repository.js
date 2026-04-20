const { pool } = require('../../config/db');

function buildServiceWhere(filters = {}) {
  const where = ['s.deleted_at IS NULL', 'u.deleted_at IS NULL', "u.role <> 'ADMIN_MASTER'"];
  const params = [];

  if (filters.startAt) {
    where.push('s.start_at >= ?');
    params.push(filters.startAt);
  }

  if (filters.endAt) {
    where.push('s.start_at < ?');
    params.push(filters.endAt);
  }

  if (filters.userId) {
    where.push('s.user_id = ?');
    params.push(filters.userId);
  }

  if (filters.serviceType) {
    where.push('st.`key` = ?');
    params.push(filters.serviceType);
  }

  if (filters.operationalStatus) {
    where.push('s.operational_status = ?');
    params.push(filters.operationalStatus);
  }

  if (filters.financialStatus) {
    where.push('s.financial_status = ?');
    params.push(filters.financialStatus);
  }

  return { where, params };
}

function buildRangeFilters(column, filters = {}) {
  const where = [];
  const params = [];

  if (filters.startAt) {
    where.push(`${column} >= ?`);
    params.push(filters.startAt);
  }

  if (filters.endAt) {
    where.push(`${column} < ?`);
    params.push(filters.endAt);
  }

  return { where, params };
}

const OPEN_BALANCE_EXPR = `
  GREATEST(
    CASE
      WHEN s.amount_balance IS NOT NULL AND s.amount_balance > 0 THEN s.amount_balance
      ELSE (COALESCE(s.amount_total, 0) - COALESCE(s.amount_paid, 0))
    END,
    0
  )
`;

async function getUsersTotal(filters = {}) {
  const where = ['u.deleted_at IS NULL', "u.role <> 'ADMIN_MASTER'"];
  const params = [];

  if (filters.userId) {
    where.push('u.id = ?');
    params.push(filters.userId);
  }

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS users_total
       FROM users u
      WHERE ${where.join(' AND ')}`,
    params
  );

  return rows[0] || { users_total: 0 };
}

async function getFinancialSummary(filters = {}) {
  const { where, params } = buildServiceWhere(filters);

  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS total_services,
       COALESCE(SUM(COALESCE(s.amount_total, 0)), 0) AS total_expected,
       COALESCE(SUM(COALESCE(s.amount_paid, 0)), 0) AS total_paid,
       COALESCE(SUM(
         CASE
           WHEN s.financial_status IN ('NAO_PAGO', 'PENDENTE', 'EM_ATRASO', 'PAGO_PARCIAL') THEN ${OPEN_BALANCE_EXPR}
           ELSE 0
         END
       ), 0) AS total_open_balance,
       COALESCE(SUM(
         CASE
           WHEN s.financial_status = 'EM_ATRASO'
             OR (
               s.financial_status IN ('NAO_PAGO', 'PENDENTE', 'PAGO_PARCIAL')
               AND s.payment_due_date IS NOT NULL
               AND s.payment_due_date < CURDATE()
             )
           THEN ${OPEN_BALANCE_EXPR}
           ELSE 0
         END
       ), 0) AS total_overdue_balance
     FROM services s
     JOIN service_types st ON st.id = s.service_type_id
    JOIN users u ON u.id = s.user_id
     WHERE ${where.join(' AND ')}`,
    params
  );

  return rows[0] || null;
}

async function getFinancialByStatus(filters = {}) {
  const { where, params } = buildServiceWhere(filters);

  const [rows] = await pool.query(
    `SELECT
       s.financial_status,
       COUNT(*) AS services_count,
       COALESCE(SUM(COALESCE(s.amount_total, 0)), 0) AS total_expected,
       COALESCE(SUM(COALESCE(s.amount_paid, 0)), 0) AS total_paid,
       COALESCE(SUM(${OPEN_BALANCE_EXPR}), 0) AS total_open_balance
     FROM services s
     JOIN service_types st ON st.id = s.service_type_id
    JOIN users u ON u.id = s.user_id
     WHERE ${where.join(' AND ')}
     GROUP BY s.financial_status
     ORDER BY services_count DESC, s.financial_status ASC`,
    params
  );

  return rows;
}

async function getOperationalSummary(filters = {}) {
  const { where, params } = buildServiceWhere(filters);

  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS total_services,
       COALESCE(SUM(COALESCE(s.duration_hours, 0)), 0) AS total_hours
     FROM services s
     JOIN service_types st ON st.id = s.service_type_id
    JOIN users u ON u.id = s.user_id
     WHERE ${where.join(' AND ')}`,
    params
  );

  return rows[0] || null;
}

async function getOperationalByStatus(filters = {}) {
  const { where, params } = buildServiceWhere(filters);

  const [rows] = await pool.query(
    `SELECT
       s.operational_status,
       COUNT(*) AS services_count,
       COALESCE(SUM(COALESCE(s.duration_hours, 0)), 0) AS total_hours
     FROM services s
     JOIN service_types st ON st.id = s.service_type_id
    JOIN users u ON u.id = s.user_id
     WHERE ${where.join(' AND ')}
     GROUP BY s.operational_status
     ORDER BY services_count DESC, s.operational_status ASC`,
    params
  );

  return rows;
}

async function getServicesByType(filters = {}) {
  const { where, params } = buildServiceWhere(filters);

  const [rows] = await pool.query(
    `SELECT
       st.id AS service_type_id,
       st.\`key\` AS service_type_key,
       st.name AS service_type_name,
       st.category AS service_type_category,
       COUNT(*) AS services_count,
       COALESCE(SUM(COALESCE(s.duration_hours, 0)), 0) AS total_hours,
       COALESCE(SUM(COALESCE(s.amount_total, 0)), 0) AS total_expected
     FROM services s
     JOIN service_types st ON st.id = s.service_type_id
    JOIN users u ON u.id = s.user_id
     WHERE ${where.join(' AND ')}
     GROUP BY st.id, st.\`key\`, st.name, st.category
     ORDER BY services_count DESC, st.name ASC`,
    params
  );

  return rows;
}

async function getTrafficSummary(filters = {}) {
  const serviceRange = buildRangeFilters('s.updated_at', filters);
  const historyRange = buildRangeFilters('h.created_at', filters);
  const loginRange = buildRangeFilters('u.last_login_at', filters);

  const userFilterClause = filters.userId ? ' AND u.id = ?' : '';

  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users u WHERE u.deleted_at IS NULL AND u.role <> 'ADMIN_MASTER'${userFilterClause}) AS users_total,
       (SELECT COUNT(*) FROM users u WHERE u.deleted_at IS NULL AND u.role <> 'ADMIN_MASTER' AND u.last_login_at IS NOT NULL${userFilterClause}${loginRange.where.length ? ` AND ${loginRange.where.join(' AND ')}` : ''}) AS users_logged_in_period,
       (SELECT COUNT(DISTINCT s.user_id)
          FROM services s
         JOIN users u2 ON u2.id = s.user_id
        WHERE s.deleted_at IS NULL AND u2.deleted_at IS NULL AND u2.role <> 'ADMIN_MASTER'${filters.userId ? ' AND s.user_id = ?' : ''}${serviceRange.where.length ? ` AND ${serviceRange.where.join(' AND ')}` : ''}) AS users_with_service_updates,
       (SELECT COUNT(*)
          FROM services s
         JOIN users u2 ON u2.id = s.user_id
        WHERE s.deleted_at IS NULL AND u2.deleted_at IS NULL AND u2.role <> 'ADMIN_MASTER'${filters.userId ? ' AND s.user_id = ?' : ''}${serviceRange.where.length ? ` AND ${serviceRange.where.join(' AND ')}` : ''}) AS service_updates,
       (SELECT COUNT(*)
          FROM service_status_history h
          JOIN services s ON s.id = h.service_id
         JOIN users u2 ON u2.id = s.user_id
        WHERE s.deleted_at IS NULL AND u2.deleted_at IS NULL AND u2.role <> 'ADMIN_MASTER'${filters.userId ? ' AND s.user_id = ?' : ''}${historyRange.where.length ? ` AND ${historyRange.where.join(' AND ')}` : ''}) AS status_transitions`,
    [
      ...(filters.userId ? [filters.userId] : []),
      ...(filters.userId ? [filters.userId] : []),
      ...loginRange.params,
      ...(filters.userId ? [filters.userId] : []),
      ...serviceRange.params,
      ...(filters.userId ? [filters.userId] : []),
      ...serviceRange.params,
      ...(filters.userId ? [filters.userId] : []),
      ...historyRange.params,
    ]
  );

  return rows[0] || null;
}

async function getTopActiveUsers(filters = {}, limit = 10) {
  const serviceRange = buildRangeFilters('s.created_at', filters);
  const historyRange = buildRangeFilters('h.created_at', filters);

  const [rows] = await pool.query(
    `SELECT
       u.id,
       u.name,
       u.email,
       COALESCE(sc.services_created, 0) AS services_created,
       COALESCE(hc.status_changes, 0) AS status_changes,
       (COALESCE(sc.services_created, 0) + COALESCE(hc.status_changes, 0)) AS activity_events
     FROM users u
     LEFT JOIN (
       SELECT s.user_id, COUNT(*) AS services_created
         FROM services s
         JOIN users su ON su.id = s.user_id
        WHERE s.deleted_at IS NULL AND su.deleted_at IS NULL AND su.role <> 'ADMIN_MASTER'${filters.userId ? ' AND s.user_id = ?' : ''}${serviceRange.where.length ? ` AND ${serviceRange.where.join(' AND ')}` : ''}
        GROUP BY s.user_id
     ) sc ON sc.user_id = u.id
     LEFT JOIN (
       SELECT h.changed_by AS user_id, COUNT(*) AS status_changes
         FROM service_status_history h
         JOIN users au ON au.id = h.changed_by
        WHERE au.deleted_at IS NULL AND au.role <> 'ADMIN_MASTER'${filters.userId ? ' AND h.changed_by = ?' : ''}${historyRange.where.length ? ` AND ${historyRange.where.join(' AND ')}` : ''}
        GROUP BY h.changed_by
     ) hc ON hc.user_id = u.id
     WHERE u.deleted_at IS NULL AND u.role <> 'ADMIN_MASTER'${filters.userId ? ' AND u.id = ?' : ''}
     ORDER BY activity_events DESC, u.id ASC
     LIMIT ?`,
    [
      ...(filters.userId ? [filters.userId] : []),
      ...serviceRange.params,
      ...(filters.userId ? [filters.userId] : []),
      ...historyRange.params,
      ...(filters.userId ? [filters.userId] : []),
      Number(limit) || 10,
    ]
  );

  return rows;
}

module.exports = {
  getUsersTotal,
  getFinancialSummary,
  getFinancialByStatus,
  getOperationalSummary,
  getOperationalByStatus,
  getServicesByType,
  getTrafficSummary,
  getTopActiveUsers,
};
