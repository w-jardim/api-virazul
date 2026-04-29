const AppError = require('../utils/app-error');
const logger = require('../utils/logger');
const subscriptionsRepo = require('../modules/subscriptions/subscriptions.repository');
const {
  hasDateExpired,
  normalizePlanCode,
  resolveAccountAccess,
} = require('../utils/plan-access');

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

async function enforcePlan(req, res, next) {
  if (READ_METHODS.includes(req.method)) return next();
  if (!req.user || req.user.role === 'ADMIN_MASTER') return next();

  try {
    const sub = await subscriptionsRepo.findCurrentByUserId(req.user.id);

    if (!sub) return next();

    const { status, trial_ends_at, current_period_end, partner_expires_at } = sub;
    const access = resolveAccountAccess({
      rawPlan: sub.raw_plan || sub.plan,
      subscriptionStatus: status,
      currentPeriodEnd: current_period_end,
      trialEndsAt: trial_ends_at,
      partnerExpiresAt: partner_expires_at,
    });

    if (access.partnerActive) {
      return next();
    }

    if (status === 'trialing') {
      if (hasDateExpired(trial_ends_at)) {
        logger.warn('plan.trial_expired', { user_id: req.user.id });
        await subscriptionsRepo.updateSubscriptionStatus(sub.id, 'expired');
        await subscriptionsRepo.syncLegacyUserFields(req.user.id, { subscription: 'plan_free' });
        return next(new AppError('PLAN_EXPIRED', 'Periodo de teste expirado. Acesso somente leitura.', 403));
      }
      return next();
    }

    if (status === 'active') {
      if (hasDateExpired(current_period_end)) {
        logger.warn('plan.paid_expired', { user_id: req.user.id });
        await subscriptionsRepo.updateSubscriptionStatus(sub.id, 'past_due');
        await subscriptionsRepo.syncLegacyUserFields(req.user.id, {
          subscription: normalizePlanCode(sub.plan, { fallback: 'plan_pro' }),
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

    const access = resolveAccountAccess({
      rawPlan: sub.raw_plan || sub.plan,
      subscriptionStatus: sub.status,
      currentPeriodEnd: sub.current_period_end,
      trialEndsAt: sub.trial_ends_at,
      partnerExpiresAt: sub.partner_expires_at,
    });

    if (access.partnerActive) {
      return next();
    }

    if (!sub || sub.status !== 'active' || normalizePlanCode(sub.plan, { fallback: null }) !== 'plan_pro') {
      return next(new AppError('PLAN_PRO_REQUIRED', 'Este recurso requer plano Pro ativo.', 403));
    }

    if (hasDateExpired(sub.current_period_end)) {
      return next(new AppError('PLAN_PRO_REQUIRED', 'Plano Pro vencido. Renove para continuar.', 403));
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { enforcePlan, requirePremium };
