const { pool } = require('../../config/db');

function buildDateRangeWhere(filters, params) {
  const where = [];

  if (filters.startAt) {
    where.push('s.start_at >= ?');
    params.push(filters.startAt);
  }

  if (filters.endAt) {
    where.push('s.start_at < ?');
    params.push(filters.endAt);
  }

  return where;
}

async function listServicesForFinance(userId, filters = {}) {
  const params = [userId];
  const where = ['s.user_id = ?', 's.deleted_at IS NULL'];

  where.push(...buildDateRangeWhere(filters, params));

  if (filters.serviceType) {
    where.push('st.`key` = ?');
    params.push(filters.serviceType);
  }

  if (filters.financialStatus) {
    where.push('s.financial_status = ?');
    params.push(filters.financialStatus);
  }

  const [rows] = await pool.query(
    `SELECT
       s.id,
       s.start_at,
       s.duration_hours,
       s.operational_status,
       s.financial_status,
       s.amount_total,
       s.amount_paid,
       s.amount_balance,
       s.payment_due_date,
       st.id AS service_type_id,
       st.\`key\` AS service_type_key,
       st.name AS service_type_name,
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
  listServicesForFinance,
};
