const { pool } = require('../../config/db');

async function listByUserInRange(userId, startAt, endAt) {
  // startAt and endAt should be Date objects or ISO strings in UTC
  const [rows] = await pool.query(
    'SELECT s.id, s.user_id, s.service_type_id, s.start_at, s.duration_hours,\n' +
      "            s.operational_status, s.financial_status, s.notes,\n" +
      "            st.`key` AS service_type_key, st.name AS service_type_name, st.category AS service_category\n" +
      "       FROM services s\n" +
      "       JOIN service_types st ON st.id = s.service_type_id\n" +
      "      WHERE s.user_id = ?\n" +
      "        AND s.deleted_at IS NULL\n" +
      "        AND s.start_at BETWEEN ? AND ?\n" +
      "      ORDER BY s.start_at ASC, s.id ASC",
    [userId, startAt, endAt]
  );

  return rows;
}

module.exports = {
  listByUserInRange,
};
