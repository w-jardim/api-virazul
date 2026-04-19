const bcrypt = require('bcrypt');
const { pool } = require('../../config/db');

const USER_FIELDS = `id, name, email, role, status, subscription, payment_status, payment_due_date, rank_group, created_at, updated_at, last_login_at`;

function normalizeBilling(user) {
  if (!user) return user;

  if (user.subscription === 'free' || user.role === 'ADMIN_MASTER') {
    user.payment_status = null;
    user.payment_due_date = null;
  }

  return user;
}

async function findAll() {
  const [rows] = await pool.query(
    `SELECT ${USER_FIELDS}
       FROM users
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC`
  );
  return rows.map(normalizeBilling);
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${USER_FIELDS}
       FROM users
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1`,
    [id]
  );
  return normalizeBilling(rows[0] || null);
}

async function create(user) {
  const passwordHash = await bcrypt.hash(user.password, 10);

  let paymentStatus = user.payment_status || 'pending';
  let paymentDueDate = user.payment_due_date || null;

  if (user.subscription === 'free' || user.role === 'ADMIN_MASTER') {
    paymentStatus = 'pending';
    paymentDueDate = null;
  }

  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, status, subscription, payment_status, payment_due_date, rank_group)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.name,
      user.email,
      passwordHash,
      user.role,
      user.status,
      user.subscription,
      paymentStatus,
      paymentDueDate,
      user.rank_group || null,
    ]
  );

  return findById(result.insertId);
}

async function updateById(id, payload) {
  const fields = [];
  const values = [];

  if (payload.name !== undefined) { fields.push('name = ?'); values.push(payload.name); }
  if (payload.email !== undefined) { fields.push('email = ?'); values.push(payload.email); }
  if (payload.password !== undefined) {
    const passwordHash = await bcrypt.hash(payload.password, 10);
    fields.push('password_hash = ?');
    values.push(passwordHash);
  }
  if (payload.role !== undefined) { fields.push('role = ?'); values.push(payload.role); }
  if (payload.status !== undefined) { fields.push('status = ?'); values.push(payload.status); }
  if (payload.subscription !== undefined) { fields.push('subscription = ?'); values.push(payload.subscription); }

  if (payload.subscription !== 'free') {
    if (payload.payment_status !== undefined) { fields.push('payment_status = ?'); values.push(payload.payment_status); }
    if (payload.payment_due_date !== undefined) { fields.push('payment_due_date = ?'); values.push(payload.payment_due_date || null); }
  }

  if (payload.rank_group !== undefined) { fields.push('rank_group = ?'); values.push(payload.rank_group || null); }

  if (fields.length === 0) return findById(id);

  values.push(id);
  await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    values
  );
  return findById(id);
}

async function deleteById(id) {
  const [result] = await pool.query(
    'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return result.affectedRows > 0;
}

async function updateSubscription(id, subscription) {
  if (subscription === 'free') {
    await pool.query(
      'UPDATE users SET subscription = ? WHERE id = ? AND deleted_at IS NULL',
      [subscription, id]
    );
  } else {
    await pool.query(
      'UPDATE users SET subscription = ?, payment_status = IFNULL(payment_status, \'pending\') WHERE id = ? AND deleted_at IS NULL',
      [subscription, id]
    );
  }
  return findById(id);
}

async function updatePaymentStatus(id, paymentStatus) {
  const user = await findById(id);
  if (!user || user.subscription === 'free' || user.role === 'ADMIN_MASTER') {
    return user;
  }
  await pool.query(
    'UPDATE users SET payment_status = ? WHERE id = ? AND deleted_at IS NULL',
    [paymentStatus, id]
  );
  return findById(id);
}

async function getStats() {
  const [[userRow]] = await pool.query(
    `SELECT
      COUNT(*) AS total_users,
      SUM(status = 'active') AS active_users,
      SUM(status = 'inactive') AS inactive_users,
      SUM(status = 'suspended') AS suspended_users
     FROM users
    WHERE deleted_at IS NULL`
  );

  // Subscription stats from the authoritative subscriptions table
  const [[subRow]] = await pool.query(
    `SELECT
      COALESCE(SUM(s.status = 'trialing'), 0) AS trial,
      COALESCE(SUM(s.status = 'active' AND s.plan = 'premium'), 0) AS premium
     FROM subscriptions s
     INNER JOIN (
       SELECT owner_user_id, MAX(id) AS max_id
       FROM subscriptions
       GROUP BY owner_user_id
     ) latest ON latest.max_id = s.id
     INNER JOIN users u ON u.id = s.owner_user_id
     WHERE u.deleted_at IS NULL`
  );

  const total = Number(userRow.total_users) || 0;
  const trial = Number(subRow.trial) || 0;
  const premium = Number(subRow.premium) || 0;

  return {
    total_users: total,
    active_users: Number(userRow.active_users) || 0,
    inactive_users: Number(userRow.inactive_users) || 0,
    suspended_users: Number(userRow.suspended_users) || 0,
    free: Math.max(0, total - trial - premium),
    trial,
    premium,
  };
}

module.exports = {
  findAll,
  findById,
  create,
  updateById,
  deleteById,
  updateSubscription,
  updatePaymentStatus,
  getStats,
};
