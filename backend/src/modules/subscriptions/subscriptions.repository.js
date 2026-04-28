const { pool } = require('../../config/db');
const { normalizePlanCode } = require('../../utils/plan-access');

function normalizeSubscriptionRecord(record) {
  if (!record) {
    return record;
  }

  const rawPlan = record.raw_plan || record.plan || null;
  const normalizedPlan = normalizePlanCode(rawPlan, { fallback: null });

  return {
    ...record,
    raw_plan: rawPlan,
    plan: normalizedPlan || rawPlan,
    plan_code: normalizePlanCode(record.plan_code || rawPlan, { fallback: null }) || record.plan_code || rawPlan,
    is_legacy_plan: Boolean(rawPlan) && normalizedPlan !== null && rawPlan !== normalizedPlan,
  };
}

async function findLatestByUserId(userId) {
  return findCurrentByUserId(userId);
}

async function findCurrentByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT s.*, s.plan AS raw_plan, p.code AS plan_code, p.name AS plan_name, p.price_cents, p.billing_cycle
       FROM subscriptions s
       LEFT JOIN plans p ON p.code = s.plan
      WHERE s.owner_user_id = ?
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 1`,
    [userId]
  );
  return normalizeSubscriptionRecord(rows[0] || null);
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM subscriptions WHERE id = ? LIMIT 1',
    [id]
  );
  return normalizeSubscriptionRecord(rows[0] || null);
}

async function findByGatewaySubscriptionId(gateway, gatewaySubscriptionId) {
  const [rows] = await pool.query(
    'SELECT * FROM subscriptions WHERE gateway = ? AND gateway_subscription_id = ? LIMIT 1',
    [gateway, gatewaySubscriptionId]
  );
  return normalizeSubscriptionRecord(rows[0] || null);
}

async function createTrialSubscription(userId, trialDays) {
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const [result] = await pool.query(
    `INSERT INTO subscriptions
       (owner_user_id, plan, status, started_at, trial_ends_at, current_period_start, current_period_end)
     VALUES (?, 'plan_pro', 'trialing', ?, ?, ?, ?)`,
    [userId, now, trialEndsAt, now, trialEndsAt]
  );
  return result.insertId;
}

async function createSubscription({ userId, plan, status, trialEndsAt, currentPeriodStart, currentPeriodEnd }) {
  const normalizedPlan = normalizePlanCode(plan, { fallback: 'plan_free' });
  const now = new Date();
  const [result] = await pool.query(
    `INSERT INTO subscriptions
       (owner_user_id, plan, status, started_at, trial_ends_at, current_period_start, current_period_end)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, normalizedPlan, status, now, trialEndsAt || null, currentPeriodStart || null, currentPeriodEnd || null]
  );
  return result.insertId;
}

async function updateSubscriptionStatus(id, status) {
  await pool.query(
    'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );
}

async function updateSubscriptionCycle(id, { status, plan, currentPeriodStart, currentPeriodEnd, expiresAt }) {
  const normalizedPlan = normalizePlanCode(plan, { fallback: 'plan_free' });
  await pool.query(
    `UPDATE subscriptions
        SET status = ?, plan = ?, current_period_start = ?, current_period_end = ?,
            expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [status, normalizedPlan, currentPeriodStart, currentPeriodEnd, expiresAt || currentPeriodEnd, id]
  );
}

async function attachGatewayData(id, { gateway, gatewayCustomerId, gatewaySubscriptionId }) {
  await pool.query(
    `UPDATE subscriptions
        SET gateway = ?, gateway_customer_id = ?, gateway_subscription_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [gateway, gatewayCustomerId || null, gatewaySubscriptionId || null, id]
  );
}

async function cancelSubscription(id) {
  await pool.query(
    `UPDATE subscriptions
        SET status = 'canceled', canceled_at = NOW(), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [id]
  );
}

async function setPartnerPlan(userId, days) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);

  await pool.query(
    `UPDATE subscriptions
        SET plan = 'plan_partner', partner_expires_at = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE owner_user_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
    [expires, userId]
  );

  return expires;
}

async function syncLegacyUserFields(userId, fields) {
  const mapping = {
    subscription: 'subscription',
    payment_status: 'payment_status',
    payment_due_date: 'payment_due_date',
    paymentStatus: 'payment_status',
    paymentDueDate: 'payment_due_date',
  };

  const updates = [];
  const values = [];

  for (const key in fields) {
    const dbKey = mapping[key];
    if (dbKey) {
      updates.push(`${dbKey} = ?`);
      if (dbKey === 'subscription') {
        values.push(normalizePlanCode(fields[key], { fallback: 'plan_free' }));
      } else {
        values.push(fields[key]);
      }
    }
  }

  if (updates.length === 0) return;

  values.push(userId);
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
}

module.exports = {
  findLatestByUserId,
  findCurrentByUserId,
  findById,
  findByGatewaySubscriptionId,
  createTrialSubscription,
  createSubscription,
  updateSubscriptionStatus,
  updateSubscriptionCycle,
  attachGatewayData,
  cancelSubscription,
  setPartnerPlan,
  syncLegacyUserFields,
  normalizeSubscriptionRecord,
};
