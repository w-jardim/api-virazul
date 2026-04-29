const AppError = require('../../utils/app-error');
const logger = require('../../utils/logger');
const { normalizePlanCode, resolveBasePlan } = require('../../utils/plan-access');
const adminRepository = require('./admin.repository');

const ADMIN_PAYMENT_STATUS_TO_SUBSCRIPTION_STATUS = {
  paid: 'active',
  pending: 'pending',
  overdue: 'past_due',
};
const DEFAULT_PARTNER_DAYS = 365;

async function getStats() {
  return adminRepository.getStats();
}

async function listUsers() {
  return adminRepository.findAll();
}

async function createUser(payload) {
  const user = await adminRepository.create(payload);
  if (!user) {
    throw new AppError('CREATE_USER_FAILED', 'Nao foi possivel criar o usuario.', 500);
  }

  return user;
}

async function updateUser(id, payload) {
  const user = await adminRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }
  return adminRepository.updateById(id, payload);
}

async function deleteUser(id) {
  const user = await adminRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }
  const deleted = await adminRepository.deleteById(id);
  if (!deleted) {
    throw new AppError('DELETE_USER_FAILED', 'Nao foi possivel remover o usuario.', 500);
  }
}

async function changeSubscription(id, subscription) {
  const user = await adminRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }

  const planCode = normalizePlanCode(subscription, { fallback: null });
  if (!planCode) {
    throw new AppError('INVALID_PLAN', 'Plano invalido ou nao suportado.', 400);
  }

  const subscriptionsRepo = require('../subscriptions/subscriptions.repository');
  const sub = await subscriptionsRepo.findCurrentByUserId(id);
  const now = new Date();
  const basePlan = resolveBasePlan({
    rawPlan: user.subscription,
    userBasePlan: user.subscription,
    fallbackPlan: 'plan_starter',
  });

  if (planCode === 'plan_partner') {
    await adminRepository.updateSubscription(id, basePlan);
    await subscriptionsRepo.setPartnerPlan(id, DEFAULT_PARTNER_DAYS);
    logger.info('admin.partner.granted', { user_id: id, base_plan: basePlan, duration_days: DEFAULT_PARTNER_DAYS });
    return adminRepository.findById(id);
  }

  await adminRepository.updateSubscription(id, planCode);

  if (planCode === 'plan_starter' || planCode === 'plan_pro') {
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (sub) {
      await subscriptionsRepo.updateSubscriptionCycle(sub.id, {
        status: 'active',
        plan: planCode,
        trialEndsAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        partnerExpiresAt: null,
        canceledAt: null,
      });
    } else {
      await subscriptionsRepo.createSubscription({
        userId: id,
        plan: planCode,
        status: 'active',
        trialEndsAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        partnerExpiresAt: null,
      });
    }
    await subscriptionsRepo.syncLegacyUserFields(id, {
      subscription: planCode,
      paymentStatus: 'paid',
      paymentDueDate: periodEnd.toISOString().slice(0, 10),
    });
  } else if (planCode === 'plan_free') {
    if (sub) {
      await subscriptionsRepo.updateSubscriptionCycle(sub.id, {
        status: 'active',
        plan: planCode,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        expiresAt: null,
        partnerExpiresAt: null,
        canceledAt: null,
      });
    } else {
      await subscriptionsRepo.createSubscription({
        userId: id,
        plan: planCode,
        status: 'active',
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        partnerExpiresAt: null,
      });
    }

    await subscriptionsRepo.syncLegacyUserFields(id, {
      subscription: planCode,
      paymentStatus: null,
      paymentDueDate: null,
    });
  }

  logger.info('admin.subscription.changed', { user_id: id, subscription: planCode });
  return adminRepository.findById(id);
}

async function changePaymentStatus(id, paymentStatus) {
  const user = await adminRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }

  if (user.subscription === 'plan_free' || user.role === 'ADMIN_MASTER') {
    return adminRepository.updatePaymentStatus(id, null);
  }

  const subscriptionStatus = ADMIN_PAYMENT_STATUS_TO_SUBSCRIPTION_STATUS[paymentStatus];
  if (!subscriptionStatus) {
    throw new AppError('INVALID_PAYMENT_STATUS', 'Status de pagamento invalido.', 400);
  }

  const subscriptionsRepo = require('../subscriptions/subscriptions.repository');
  const currentSubscription = await subscriptionsRepo.findCurrentByUserId(id);

  if (currentSubscription) {
    await subscriptionsRepo.updateLatestStatusByUserId(id, subscriptionStatus);
  } else {
    await subscriptionsRepo.createSubscription({
      userId: id,
      plan: user.subscription,
      status: subscriptionStatus,
      trialEndsAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: user.payment_due_date || null,
      partnerExpiresAt: null,
    });
  }

  const updatedUser = await adminRepository.updatePaymentStatus(id, paymentStatus);
  logger.info('admin.payment-status.changed', {
    user_id: id,
    subscription: user.subscription,
    payment_status: paymentStatus,
    subscription_status: subscriptionStatus,
  });
  return updatedUser;
}

module.exports = {
  getStats,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  changeSubscription,
  changePaymentStatus,
};
