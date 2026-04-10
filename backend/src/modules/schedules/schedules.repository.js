const { pool } = require('../../config/db');

async function findOrdinaryServiceType() {
  const [rows] = await pool.query(
    `SELECT id, \`key\`, name, category, counts_in_financial, allows_reservation
       FROM service_types
      WHERE category = 'ORDINARY'
      ORDER BY id ASC
      LIMIT 1`
  );

  return rows[0] || null;
}

async function findOverlaps({ userId, startAt, endAt }) {
  const [rows] = await pool.query(
    `SELECT s.id, s.start_at, s.duration_hours, s.operational_status,
            st.\`key\` AS service_type_key, st.name AS service_type_name
       FROM services s
       JOIN service_types st ON st.id = s.service_type_id
      WHERE s.user_id = ?
        AND s.deleted_at IS NULL
        AND s.start_at < ?
        AND DATE_ADD(s.start_at, INTERVAL s.duration_hours HOUR) > ?
      ORDER BY s.start_at ASC, s.id ASC
      LIMIT 20`,
    [userId, endAt, startAt]
  );

  return rows;
}

async function getConnection() {
  return pool.getConnection();
}

async function createService(connection, payload) {
  const [result] = await connection.query(
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
      payment_due_date,
      payment_at,
      is_complementary,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      payload.payment_due_date,
      payload.payment_at,
      Number(payload.is_complementary),
      payload.created_by,
    ]
  );

  return result.insertId;
}

function buildInClause(ids) {
  return ids.map(() => '?').join(', ');
}

async function findByIds(ids) {
  if (!ids || ids.length === 0) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT s.*, st.\`key\` AS service_type_key, st.name AS service_type_name
       FROM services s
       JOIN service_types st ON st.id = s.service_type_id
      WHERE s.id IN (${buildInClause(ids)})
      ORDER BY s.start_at ASC, s.id ASC`,
    ids
  );

  return rows;
}

module.exports = {
  findOrdinaryServiceType,
  findOverlaps,
  getConnection,
  createService,
  findByIds,
};
