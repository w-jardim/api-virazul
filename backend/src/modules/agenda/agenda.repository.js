const { pool } = require('../../config/db');

async function listByUserInRange(userId, startAt, endAt) {
  const [rows] = await pool.query(
    `SELECT s.id, s.user_id, s.service_type_id, s.start_at, s.duration_hours,
            s.operational_status, s.financial_status, s.notes,
            st.\`key\` AS service_type_key, st.name AS service_type_name, st.category AS service_category
       FROM services s
       JOIN service_types st ON st.id = s.service_type_id
      WHERE s.user_id = ?
        AND s.deleted_at IS NULL
        AND s.start_at >= ?
        AND s.start_at < ?
      ORDER BY s.start_at ASC, s.id ASC`,
    [userId, startAt, endAt]
  );

  return rows;
}

module.exports = {
  listByUserInRange,
};
