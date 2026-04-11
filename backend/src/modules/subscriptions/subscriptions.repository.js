const { pool } = require('../../config/db');

async function findLatestByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT id, owner_user_id, status, plan, started_at, expires_at
       FROM subscriptions
      WHERE owner_user_id = ?
      ORDER BY started_at DESC, id DESC
      LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

module.exports = {
  findLatestByUserId,
};
