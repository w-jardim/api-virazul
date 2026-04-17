const { pool } = require('../config/db');
const AppError = require('../utils/app-error');
const logger = require('../utils/logger');

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

async function getUserPlanInfo(userId) {
  const [rows] = await pool.query(
    'SELECT subscription, payment_due_date, created_at FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

function isTrialExpired(createdAt) {
  if (!createdAt) return true;
  const created = new Date(createdAt);
  const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
  return new Date() > expiry;
}

function isPremiumExpired(paymentDueDate) {
  if (!paymentDueDate) return false;
  const due = new Date(paymentDueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today > due;
}

async function enforcePlan(req, res, next) {
  if (READ_METHODS.includes(req.method)) return next();

  if (!req.user || req.user.role === 'ADMIN_MASTER') return next();

  try {
    const plan = await getUserPlanInfo(req.user.id);
    if (!plan) return next();

    const { subscription, payment_due_date, created_at } = plan;

    if (subscription === 'free') return next();

    if (subscription === 'trial' && isTrialExpired(created_at)) {
      logger.warn('plan.trial_expired', { user_id: req.user.id });
      return next(
        new AppError('PLAN_EXPIRED', 'Periodo de teste expirado. Acesso somente leitura.', 403)
      );
    }

    if (subscription === 'premium' && isPremiumExpired(payment_due_date)) {
      logger.warn('plan.premium_expired', { user_id: req.user.id });
      return next(
        new AppError('PLAN_EXPIRED', 'Plano vencido. Renove para continuar operando.', 403)
      );
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { enforcePlan };
