const { pool } = require('../../config/db');

async function listByUser(userId, filters = {}) {
  const where = ['a.user_id = ?', 'a.deleted_at IS NULL'];
  const params = [userId];

  if (filters.type) {
    where.push('a.alert_type = ?');
    params.push(filters.type);
  }

  if (filters.status) {
    where.push('a.status = ?');
    params.push(filters.status);
  }

  const [rows] = await pool.query(
    `SELECT a.*
       FROM alerts a
      WHERE ${where.join(' AND ')}
      ORDER BY a.created_at DESC, a.id DESC`,
    params
  );

  return rows;
}

async function findByIdAndUser(alertId, userId) {
  const [rows] = await pool.query(
    `SELECT *
       FROM alerts
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
      LIMIT 1`,
    [alertId, userId]
  );

  return rows[0] || null;
}

async function markStatus(alertId, userId, status) {
  const readAt = status === 'READ' ? new Date() : null;

  await pool.query(
    `UPDATE alerts
        SET status = ?,
            read_at = CASE WHEN ? IS NULL THEN read_at ELSE ? END
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL`,
    [status, readAt, readAt, alertId, userId]
  );

  return findByIdAndUser(alertId, userId);
}

async function getAlertsByDedupeKeys(userId, dedupeKeys) {
  if (!dedupeKeys || dedupeKeys.length === 0) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, dedupe_key, status, deleted_at
       FROM alerts
      WHERE user_id = ?
        AND dedupe_key IN (?)`,
    [userId, dedupeKeys]
  );

  return rows;
}

async function insertAlertsBatch(alerts) {
  if (!alerts || alerts.length === 0) {
    return;
  }

  const placeholders = alerts.map(() => '(?, ?, ?, ?, CAST(? AS JSON), ?)').join(', ');
  const params = [];

  for (const alert of alerts) {
    params.push(
      alert.user_id,
      alert.alert_type,
      alert.related_service_id || null,
      alert.dedupe_key,
      JSON.stringify(alert.payload || {}),
      'ACTIVE'
    );
  }

  await pool.query(
    `INSERT INTO alerts (
      user_id,
      alert_type,
      related_service_id,
      dedupe_key,
      payload,
      status
    ) VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE
      payload = VALUES(payload),
      status = CASE
        WHEN status IN ('READ', 'DISMISSED') THEN status
        ELSE 'ACTIVE'
      END,
      deleted_at = CASE
        WHEN status IN ('READ', 'DISMISSED') THEN deleted_at
        ELSE NULL
      END,
      read_at = CASE
        WHEN status IN ('READ', 'DISMISSED') THEN read_at
        ELSE NULL
      END`,
    params
  );
}

async function listActiveGeneratedAlerts(userId) {
  const [rows] = await pool.query(
    `SELECT id, dedupe_key
       FROM alerts
      WHERE user_id = ?
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
        AND alert_type IN ('DAY', 'OPERATIONAL', 'FINANCIAL')`,
    [userId]
  );

  return rows;
}

async function softDeleteByIds(ids) {
  if (!ids || ids.length === 0) {
    return;
  }

  await pool.query(
    `UPDATE alerts
        SET deleted_at = CURRENT_TIMESTAMP
      WHERE id IN (?)
        AND status = 'ACTIVE'`,
    [ids]
  );
}

async function getTodayServices(userId, start, end) {
  const [rows] = await pool.query(
    `SELECT s.id, s.start_at, s.duration_hours, s.operational_status, s.financial_status,
            s.payment_due_date, s.notes, s.service_type_id, st.\`key\` AS service_type_key,
            st.name AS service_type_name
       FROM services s
       JOIN service_types st ON st.id = s.service_type_id
      WHERE s.user_id = ?
        AND s.deleted_at IS NULL
        AND s.start_at >= ?
        AND s.start_at < ?`,
    [userId, start, end]
  );

  return rows;
}

async function getOperationalPendingServices(userId, nowDate) {
  const [rows] = await pool.query(
    `SELECT s.id, s.start_at, s.duration_hours, s.operational_status, s.financial_status,
            s.payment_due_date, s.service_type_id, st.\`key\` AS service_type_key,
            st.name AS service_type_name
       FROM services s
       JOIN service_types st ON st.id = s.service_type_id
      WHERE s.user_id = ?
        AND s.deleted_at IS NULL
        AND s.start_at < ?
        AND s.operational_status NOT IN ('REALIZADO', 'FALTOU', 'CANCELADO', 'NAO_CONVERTIDO')`,
    [userId, nowDate]
  );

  return rows;
}

async function getFinancialPendingServices(userId, dayStart) {
  const [rows] = await pool.query(
    `SELECT s.id, s.start_at, s.duration_hours, s.operational_status, s.financial_status,
            s.payment_due_date, s.amount_total, s.service_type_id, st.\`key\` AS service_type_key,
            st.name AS service_type_name
       FROM services s
       JOIN service_types st ON st.id = s.service_type_id
      WHERE s.user_id = ?
        AND s.deleted_at IS NULL
        AND s.operational_status = 'REALIZADO'
        AND s.financial_status IN ('PREVISTO', 'NAO_PAGO')
        AND s.payment_due_date IS NOT NULL
        AND s.payment_due_date < DATE(?)`,
    [userId, dayStart]
  );

  return rows;
}

async function countActiveAlerts(userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM alerts
      WHERE user_id = ?
        AND status = 'ACTIVE'
        AND deleted_at IS NULL`,
    [userId]
  );

  return Number(rows[0].total || 0);
}

module.exports = {
  listByUser,
  findByIdAndUser,
  markStatus,
  getAlertsByDedupeKeys,
  insertAlertsBatch,
  listActiveGeneratedAlerts,
  softDeleteByIds,
  getTodayServices,
  getOperationalPendingServices,
  getFinancialPendingServices,
  countActiveAlerts,
};
