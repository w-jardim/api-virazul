const { pool } = require('../../config/db');

async function getUserPreferences(userId) {
  const [rows] = await pool.query(
    `SELECT monthly_hour_goal, planning_preferences
       FROM user_preferences
      WHERE user_id = ?
      LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function getMonthlyHours(userId, monthStart, monthEnd) {
  const [rows] = await pool.query(
    `SELECT
       SUM(CASE WHEN operational_status IN ('TITULAR', 'CONVERTIDO_TITULAR', 'REALIZADO')
                THEN duration_hours ELSE 0 END) AS confirmed_hours,
       SUM(CASE WHEN operational_status = 'RESERVA' THEN duration_hours ELSE 0 END) AS waiting_hours
      FROM services
      WHERE user_id = ?
        AND deleted_at IS NULL
        AND start_at >= ?
        AND start_at < ?`,
    [userId, monthStart, monthEnd]
  );

  return rows[0] || { confirmed_hours: 0, waiting_hours: 0 };
}

async function getServicesInRange(userId, start, end) {
  const [rows] = await pool.query(
    `SELECT s.id, s.start_at, s.duration_hours, s.operational_status,
            st.category AS service_category, st.\`key\` AS service_type_key
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

module.exports = {
  getUserPreferences,
  getMonthlyHours,
  getServicesInRange,
};
