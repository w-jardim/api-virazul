const AppError = require('../utils/app-error');
const logger = require('../utils/logger');
const subscriptionsRepo = require('../modules/subscriptions/subscriptions.repository');

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

async function enforcePlan(req, res, next) {
  if (READ_METHODS.includes(req.method)) return next();
  if (!req.user || req.user.role === 'ADMIN_MASTER') return next();

  try {
    const sub = await subscriptionsRepo.findCurrentByUserId(req.user.id);

    if (!sub) return next();

    const { status, trial_ends_at, current_period_end } = sub;

    if (status === 'trialing') {
      if (trial_ends_at && new Date() > new Date(trial_ends_at)) {
        logger.warn('plan.trial_expired', { user_id: req.user.id });
        await subscriptionsRepo.updateSubscriptionStatus(sub.id, 'expired');
        await subscriptionsRepo.syncLegacyUserFields(req.user.id, { subscription: 'free' });
        return next(new AppError('PLAN_EXPIRED', 'Periodo de teste expirado. Acesso somente leitura.', 403));
      }
      return next();
    }

    if (status === 'active') {
      if (current_period_end && new Date() > new Date(current_period_end)) {
        logger.warn('plan.premium_expired', { user_id: req.user.id });
        await subscriptionsRepo.updateSubscriptionStatus(sub.id, 'past_due');
        await subscriptionsRepo.syncLegacyUserFields(req.user.id, {
          subscription: 'premium',
          paymentStatus: 'overdue',
        });
        return next(new AppError('PLAN_EXPIRED', 'Plano vencido. Renove para continuar operando.', 403));
      }
      return next();
    }

    if (['expired', 'canceled', 'past_due'].includes(status)) {
      return next(new AppError('PLAN_EXPIRED', 'Assinatura expirada ou cancelada.', 403));
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

async function requirePremium(req, res, next) {
  if (!req.user || req.user.role === 'ADMIN_MASTER') return next();

  try {
    const sub = await subscriptionsRepo.findCurrentByUserId(req.user.id);

    if (!sub || sub.status !== 'active' || sub.plan !== 'premium') {
      return next(new AppError('PLAN_PREMIUM_REQUIRED', 'Este recurso requer plano Premium ativo.', 403));
    }

    if (sub.current_period_end && new Date() > new Date(sub.current_period_end)) {
      return next(new AppError('PLAN_PREMIUM_REQUIRED', 'Plano Premium vencido. Renove para continuar.', 403));
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { enforcePlan, requirePremium };
