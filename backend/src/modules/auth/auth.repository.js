const crypto = require('crypto');
const { pool } = require('../../config/db');
const passwordUtils = require('../../utils/password');

const AUTH_USER_FIELDS = `
  id,
  name,
  email,
  password_hash,
  role,
  rank_group,
  subscription,
  payment_due_date,
  google_sub,
  created_at
`;

async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT ${AUTH_USER_FIELDS}
       FROM users
      WHERE email = ?
        AND deleted_at IS NULL
      LIMIT 1`,
    [email]
  );

  return rows[0] || null;
}

async function findByGoogleSub(googleSub) {
  const [rows] = await pool.query(
    `SELECT ${AUTH_USER_FIELDS}
       FROM users
      WHERE google_sub = ?
        AND deleted_at IS NULL
      LIMIT 1`,
    [googleSub]
  );

  return rows[0] || null;
}

async function findSafeById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, email, role, status, subscription, payment_status, payment_due_date, rank_group, created_at, updated_at, last_login_at
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

async function linkGoogleSubByUserId(userId, googleSub) {
  await pool.query(
    'UPDATE users SET google_sub = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
    [googleSub, userId]
  );
}

async function updateUser(userId, fields) {
  const allowed = ['name', 'rank_group', 'password_hash'];
  const updates = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }

  if (updates.length === 0) return;

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);

  await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    values
  );
}

async function createGoogleUser({ name, email, googleSub }) {
  const randomPassword = crypto.randomUUID();
  const passwordHash = await passwordUtils.hashPassword(randomPassword);

  const [result] = await pool.query(
    `INSERT INTO users (
      name,
      email,
      password_hash,
      role,
      status,
      subscription,
      payment_status,
      payment_due_date,
      rank_group,
      google_sub
    ) VALUES (?, ?, ?, 'POLICE', 'active', 'trial', 'pending', NULL, NULL, ?)`,
    [name, email, passwordHash, googleSub]
  );

  const [rows] = await pool.query(
    `SELECT ${AUTH_USER_FIELDS}
       FROM users
      WHERE id = ?
      LIMIT 1`,
    [result.insertId]
  );

  return rows[0] || null;
}

module.exports = {
  findByEmail,
  findByGoogleSub,
  findSafeById,
  updateLastLogin,
  updateUser,
  linkGoogleSubByUserId,
  createGoogleUser,
};
