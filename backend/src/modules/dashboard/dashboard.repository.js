const { pool } = require('../../config/db');

async function getTodayServicesByUser(userId, start, end) {
  const [rows] = await pool.query(
    `SELECT s.id, s.start_at, s.duration_hours, s.operational_status, s.financial_status,
            s.notes, st.\`key\` AS service_type_key, st.name AS service_type_name
       FROM services s
       JOIN service_types st ON st.id = s.service_type_id
      WHERE s.user_id = ?
        AND s.deleted_at IS NULL
        AND s.start_at >= ?
        AND s.start_at < ?
      ORDER BY s.start_at ASC, s.id ASC`,
    [userId, start, end]
  );

  return rows;
}

async function countOperationalPendingByUser(userId, nowDate) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM services s
      WHERE s.user_id = ?
        AND s.deleted_at IS NULL
        AND s.start_at < ?
        AND s.operational_status NOT IN ('REALIZADO', 'FALTOU', 'CANCELADO', 'NAO_CONVERTIDO')`,
    [userId, nowDate]
  );

  return Number(rows[0].total || 0);
}

async function countFinancialPendingByUser(userId, dayStart) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM services s
      WHERE s.user_id = ?
        AND s.deleted_at IS NULL
        AND s.operational_status = 'REALIZADO'
        AND s.financial_status IN ('PREVISTO', 'NAO_PAGO')
        AND s.payment_due_date IS NOT NULL
        AND s.payment_due_date < DATE(?)`,
    [userId, dayStart]
  );

  return Number(rows[0].total || 0);
}

async function getMonthlyHoursByUser(userId, start, end) {
  const [rows] = await pool.query(
    `SELECT
       SUM(CASE WHEN operational_status = 'RESERVA' THEN duration_hours ELSE 0 END) AS waiting_hours,
       SUM(CASE WHEN operational_status <> 'RESERVA' THEN duration_hours ELSE 0 END) AS confirmed_hours
      FROM services
      WHERE user_id = ?
        AND deleted_at IS NULL
        AND start_at >= ?
        AND start_at < ?`,
    [userId, start, end]
  );

  return rows[0] || { waiting_hours: 0, confirmed_hours: 0 };
}

module.exports = {
  getTodayServicesByUser,
  countOperationalPendingByUser,
  countFinancialPendingByUser,
  getMonthlyHoursByUser,
};
