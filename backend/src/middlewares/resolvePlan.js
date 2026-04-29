const { pool } = require('../config/db');
const subscriptionsRepo = require('../modules/subscriptions/subscriptions.repository');
const { resolveAccountAccess } = require('../utils/plan-access');

module.exports = async function resolvePlan(req, res, next) {
  if (!req.user) {
    req.plan = 'preview';
    req.account = {
      plan: 'preview',
      status: 'active',
      entitlements: null,
      invalid_plan: false,
    };
    return next();
  }

  try {
    const [[userRow], sub] = await Promise.all([
      pool.query(
        'SELECT status, subscription, payment_status, payment_due_date FROM users WHERE id = ? LIMIT 1',
        [req.user.id]
      ),
      subscriptionsRepo.findCurrentByUserId(req.user.id),
    ]);

    const userStatus = userRow?.status || 'active';
    const rawPlan = sub?.raw_plan || sub?.plan || userRow?.subscription || 'plan_free';
    const subStatus = sub?.status || 'active';
    const partnerExpiresAt = sub?.partner_expires_at || null;
    const access = resolveAccountAccess({
      rawPlan,
      userBasePlan: userRow?.subscription || null,
      subscriptionStatus: subStatus,
      currentPeriodEnd: sub?.current_period_end || null,
      trialEndsAt: sub?.trial_ends_at || null,
      partnerExpiresAt,
    });

    // Hard blocks (banned/suspended) from users table take priority
    const accountStatus = ['banned', 'suspended'].includes(userStatus)
      ? userStatus
      : subStatus;

    req.account = {
      plan: access.effectivePlan,
      base_plan: access.basePlan,
      raw_plan: rawPlan,
      normalized_plan: access.normalizedPlan,
      status: accountStatus,
      partner_expires_at: partnerExpiresAt,
      partner_active: access.partnerActive,
      payment_state: access.paymentState,
      entitlements: access.entitlements,
      invalid_plan: !access.isKnownPlan,
      is_legacy_plan: access.isLegacyPlan,
    };
    req.plan = access.effectivePlan;

    return next();
  } catch (err) {
    return next(err);
  }
};
