const AppError = require('../../utils/app-error');
const logger = require('../../utils/logger');
const adminRepository = require('./admin.repository');

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

  if (user.subscription === 'trial') {
    const billingService = require('../billing/billing.service');
    billingService.startTrial(user.id).catch((err) => {
      logger.error('billing.trial.admin_create.failed', { user_id: user.id, error: err.message });
    });
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

  const updated = await adminRepository.updateSubscription(id, subscription);

  // Sync subscriptions table (source of truth)
  const subscriptionsRepo = require('../subscriptions/subscriptions.repository');
  const sub = await subscriptionsRepo.findCurrentByUserId(id);

  if (subscription === 'trial') {
    if (!sub) {
      const billingService = require('../billing/billing.service');
      await billingService.startTrial(id);
    } else if (sub.status !== 'trialing') {
      await subscriptionsRepo.updateSubscriptionStatus(sub.id, 'trialing');
      await subscriptionsRepo.syncLegacyUserFields(id, { subscription: 'trial' });
    }
  } else if (subscription === 'premium') {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (sub) {
      await subscriptionsRepo.updateSubscriptionCycle(sub.id, {
        status: 'active',
        plan: 'premium',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
    } else {
      await subscriptionsRepo.createSubscription({
        userId: id,
        plan: 'premium',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
    }
    await subscriptionsRepo.syncLegacyUserFields(id, {
      subscription: 'premium',
      paymentStatus: 'paid',
      paymentDueDate: periodEnd.toISOString().slice(0, 10),
    });
  } else if (subscription === 'free') {
    if (sub && !['canceled', 'expired'].includes(sub.status)) {
      await subscriptionsRepo.cancelSubscription(sub.id);
    }
    await subscriptionsRepo.syncLegacyUserFields(id, {
      subscription: 'free',
      paymentStatus: 'pending',
      paymentDueDate: null,
    });
  }

  logger.info('admin.subscription.changed', { user_id: id, subscription });
  return updated;
}

async function changePaymentStatus(id, paymentStatus) {
  const user = await adminRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }
  return adminRepository.updatePaymentStatus(id, paymentStatus);
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
