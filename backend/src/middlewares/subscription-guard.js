const env = require('../config/env');
const AppError = require('../utils/app-error');
const subscriptionsRepository = require('../modules/subscriptions/subscriptions.repository');
const logger = require('../utils/logger');
const { isBlockedSubscriptionStatus } = require('../utils/plan-access');

function isBlockedStatus(status) {
  if (!status) {
    return false;
  }
  return env.subscription.blockedStatuses.includes(String(status).toLowerCase())
    || isBlockedSubscriptionStatus(status);
}

async function enforceSubscription(req, res, next) {
  if (!env.subscription.enforce) {
    return next();
  }

  if (!req.user || req.user.role === 'ADMIN_MASTER') {
    return next();
  }

  try {
    const latest = await subscriptionsRepository.findLatestByUserId(req.user.id);
    if (latest && isBlockedStatus(latest.status)) {
      logger.warn('auth.subscription.blocked', {
        request_id: req.requestId || null,
        user_id: req.user.id,
        subscription_status: latest.status,
      });
      return next(
        new AppError(
          'SUBSCRIPTION_BLOCKED',
          'Acesso bloqueado para o status atual da assinatura.',
          403
        )
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  enforceSubscription,
};
