const bcrypt = require('bcrypt');
const { pool } = require('../../config/db');
const { normalizePlanCode, resolveEffectivePlan } = require('../../utils/plan-access');

const USER_FIELDS = `id, name, email, role, status, subscription, payment_status, payment_due_date, rank_group, created_at, updated_at, last_login_at`;

function normalizeBilling(user) {
  if (!user) return user;

  user.subscription = normalizePlanCode(user.subscription, { fallback: 'plan_free' });

  if (['plan_free', 'plan_partner'].includes(user.subscription) || user.role === 'ADMIN_MASTER') {
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
  const normalizedSubscription = normalizePlanCode(user.subscription, { fallback: 'plan_free' });

  let paymentStatus = user.payment_status || 'pending';
  let paymentDueDate = user.payment_due_date || null;

  if (['plan_free', 'plan_partner'].includes(normalizedSubscription) || user.role === 'ADMIN_MASTER') {
    paymentStatus = null;
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
      normalizedSubscription,
      paymentStatus,
      paymentDueDate,
      user.rank_group || null,
    ]
  );

  return findById(result.insertId);
}

async function updateById(id, payload) {
  const currentUser = await findById(id);
  if (!currentUser) {
    return null;
  }

  const fields = [];
  const values = [];
  const normalizedSubscription =
    payload.subscription !== undefined
      ? normalizePlanCode(payload.subscription, { fallback: 'plan_free' })
      : undefined;
  const targetSubscription = normalizedSubscription !== undefined ? normalizedSubscription : currentUser.subscription;
  const targetRole = payload.role !== undefined ? payload.role : currentUser.role;
  const isPaymentExempt = ['plan_free', 'plan_partner'].includes(targetSubscription) || targetRole === 'ADMIN_MASTER';

  if (payload.name !== undefined) { fields.push('name = ?'); values.push(payload.name); }
  if (payload.email !== undefined) { fields.push('email = ?'); values.push(payload.email); }
  if (payload.password !== undefined) {
    const passwordHash = await bcrypt.hash(payload.password, 10);
    fields.push('password_hash = ?');
    values.push(passwordHash);
  }
  if (payload.role !== undefined) { fields.push('role = ?'); values.push(payload.role); }
  if (payload.status !== undefined) { fields.push('status = ?'); values.push(payload.status); }
  if (normalizedSubscription !== undefined) { fields.push('subscription = ?'); values.push(normalizedSubscription); }

  if (isPaymentExempt) {
    fields.push('payment_status = ?');
    values.push(null);
    fields.push('payment_due_date = ?');
    values.push(null);
  } else {
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
  const normalizedSubscription = normalizePlanCode(subscription, { fallback: 'plan_free' });
  if (normalizedSubscription === 'plan_free' || normalizedSubscription === 'plan_partner') {
    await pool.query(
      'UPDATE users SET subscription = ?, payment_status = NULL, payment_due_date = NULL WHERE id = ? AND deleted_at IS NULL',
      [normalizedSubscription, id]
    );
  } else {
    await pool.query(
      'UPDATE users SET subscription = ?, payment_status = IFNULL(payment_status, \'pending\') WHERE id = ? AND deleted_at IS NULL',
      [normalizedSubscription, id]
    );
  }
  return findById(id);
}

async function updatePaymentStatus(id, paymentStatus) {
  const user = await findById(id);
  if (!user) {
    return user;
  }

  if (['plan_free', 'plan_partner'].includes(user.subscription) || user.role === 'ADMIN_MASTER') {
    await pool.query(
      'UPDATE users SET payment_status = NULL, payment_due_date = NULL WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return findById(id);
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

  const [planRows] = await pool.query(
    `SELECT
      u.id,
      u.subscription AS user_subscription,
      latest.plan AS subscription_plan,
      latest.partner_expires_at
     FROM users u
     LEFT JOIN (
       SELECT s.owner_user_id, s.plan, s.partner_expires_at
       FROM subscriptions s
       INNER JOIN (
         SELECT owner_user_id, MAX(id) AS max_id
         FROM subscriptions
         GROUP BY owner_user_id
       ) last_sub ON last_sub.max_id = s.id
     ) latest ON latest.owner_user_id = u.id
     WHERE u.deleted_at IS NULL`
  );

  const planCounts = {
    plan_free: 0,
    plan_starter: 0,
    plan_pro: 0,
    plan_partner: 0,
  };

  for (const row of planRows) {
    const effectivePlan = resolveEffectivePlan({
      rawPlan: row.subscription_plan || row.user_subscription || 'plan_free',
      partnerExpiresAt: row.partner_expires_at || null,
      fallbackPlan: 'plan_free',
    });
    const normalizedPlan = normalizePlanCode(effectivePlan, { fallback: 'plan_free' });
    planCounts[normalizedPlan] += 1;
  }

  return {
    total_users: Number(userRow.total_users) || 0,
    active_users: Number(userRow.active_users) || 0,
    inactive_users: Number(userRow.inactive_users) || 0,
    suspended_users: Number(userRow.suspended_users) || 0,
    plan_free: planCounts.plan_free,
    plan_starter: planCounts.plan_starter,
    plan_pro: planCounts.plan_pro,
    plan_partner: planCounts.plan_partner,
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
