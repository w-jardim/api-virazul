const { pool } = require('../config/db');
const subscriptionsRepo = require('../modules/subscriptions/subscriptions.repository');

module.exports = async function resolvePlan(req, res, next) {
  if (!req.user) {
    req.plan = 'preview';
    req.account = null;
    return next();
  }

  try {
    const [[userRow], sub] = await Promise.all([
      pool.query('SELECT status FROM users WHERE id = ? LIMIT 1', [req.user.id]),
      subscriptionsRepo.findCurrentByUserId(req.user.id),
    ]);

    const userStatus = userRow?.status || 'active';
    const subPlan = sub?.plan || 'plan_free';
    const subStatus = sub?.status || 'active';
    const partnerExpiresAt = sub?.partner_expires_at || null;

    // Hard blocks (banned/suspended) from users table take priority
    const accountStatus = ['banned', 'suspended'].includes(userStatus)
      ? userStatus
      : subStatus;

    req.account = {
      plan: subPlan,
      status: accountStatus,
      partner_expires_at: partnerExpiresAt,
    };

    if (subPlan === 'plan_partner') {
      req.plan = partnerExpiresAt && new Date() > new Date(partnerExpiresAt)
        ? 'plan_starter'
        : 'plan_partner';
    } else {
      req.plan = subPlan;
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
