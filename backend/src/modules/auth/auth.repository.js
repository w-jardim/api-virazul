const { pool } = require('../../config/db');

async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, name, email, password_hash, role
       FROM users
      WHERE email = ?
        AND deleted_at IS NULL
      LIMIT 1`,
    [email]
  );

  return rows[0] || null;
}

async function findSafeById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, email, role, created_at, updated_at, last_login_at
       FROM users
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function updateLastLogin(userId) {
  await pool.query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
    [userId]
  );
}

module.exports = {
  findByEmail,
  findSafeById,
  updateLastLogin,
};
