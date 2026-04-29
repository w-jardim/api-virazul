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

async function createSubscription({
  userId,
  plan,
  status,
  trialEndsAt,
  currentPeriodStart,
  currentPeriodEnd,
  partnerExpiresAt,
}) {
  const normalizedPlan = normalizePlanCode(plan, { fallback: 'plan_free' });
  const now = new Date();
  const [result] = await pool.query(
    `INSERT INTO subscriptions
       (owner_user_id, plan, status, started_at, trial_ends_at, current_period_start, current_period_end, partner_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      normalizedPlan,
      status,
      now,
      trialEndsAt || null,
      currentPeriodStart || null,
      currentPeriodEnd || null,
      partnerExpiresAt || null,
    ]
  );
  return result.insertId;
}

async function updateSubscriptionStatus(id, status) {
  await pool.query(
    'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );
}

async function updateLatestStatusByUserId(userId, status) {
  const current = await findCurrentByUserId(userId);
  if (!current) {
    return null;
  }

  await updateSubscriptionStatus(current.id, status);
  return findById(current.id);
}

async function updateSubscriptionCycle(
  id,
  { status, plan, currentPeriodStart, currentPeriodEnd, expiresAt, trialEndsAt, partnerExpiresAt, canceledAt }
) {
  const normalizedPlan = normalizePlanCode(plan, { fallback: 'plan_free' });
  await pool.query(
    `UPDATE subscriptions
        SET status = ?, plan = ?, trial_ends_at = ?, current_period_start = ?, current_period_end = ?,
            expires_at = ?, partner_expires_at = ?, canceled_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [
      status,
      normalizedPlan,
      trialEndsAt || null,
      currentPeriodStart || null,
      currentPeriodEnd || null,
      expiresAt || currentPeriodEnd || null,
      partnerExpiresAt || null,
      canceledAt || null,
      id,
    ]
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

  const current = await findCurrentByUserId(userId);

  if (current) {
    await pool.query(
      `UPDATE subscriptions
          SET partner_expires_at = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [expires, current.id]
    );
    return expires;
  }

  const [userRows] = await pool.query(
    'SELECT subscription FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const basePlan = normalizePlanCode(userRows[0]?.subscription, { fallback: 'plan_starter' });

  await createSubscription({
    userId,
    plan: basePlan,
    status: 'active',
    trialEndsAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    partnerExpiresAt: expires,
  });

  return expires;
}

async function clearPartnerCondition(userId) {
  const current = await findCurrentByUserId(userId);
  if (!current) {
    return null;
  }

  await pool.query(
    `UPDATE subscriptions
        SET partner_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [current.id]
  );

  return findById(current.id);
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

async function cleanupFreemiumSessionServices(
  userId,
  { currentSessionId = null, now = new Date().toISOString() } = {}
) {
  const sessionIdParam = currentSessionId || '__no_active_session__';
  const [result] = await pool.query(
    `UPDATE services
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND deleted_at IS NULL
        AND JSON_UNQUOTE(JSON_EXTRACT(financial_snapshot, '$.freemium_session.temporary')) = 'true'
        AND (
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(financial_snapshot, '$.freemium_session.session_expires_at')), '') < ?
          OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(financial_snapshot, '$.freemium_session.session_id')), '') <> ?
        )`,
    [userId, now, sessionIdParam]
  );

  return result.affectedRows || 0;
}

module.exports = {
  findLatestByUserId,
  findCurrentByUserId,
  findById,
  findByGatewaySubscriptionId,
  createTrialSubscription,
  createSubscription,
  updateSubscriptionStatus,
  updateLatestStatusByUserId,
  updateSubscriptionCycle,
  attachGatewayData,
  cancelSubscription,
  setPartnerPlan,
  clearPartnerCondition,
  syncLegacyUserFields,
  cleanupFreemiumSessionServices,
  normalizeSubscriptionRecord,
};
