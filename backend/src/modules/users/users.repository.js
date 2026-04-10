const { pool } = require('../../config/db');

async function findById(id) {
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

module.exports = {
  findById,
};
