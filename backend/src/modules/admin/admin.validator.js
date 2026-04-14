const Joi = require('joi');
const AppError = require('../../utils/app-error');

const createUserSchema = Joi.object({
  name: Joi.string().min(3).max(255).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('POLICE', 'ADMIN_MASTER').required(),
  status: Joi.string().valid('active', 'inactive', 'suspended').required(),
  subscription: Joi.string().valid('free', 'trial', 'premium').required(),
  payment_status: Joi.string().valid('paid', 'pending', 'overdue').default('pending'),
  payment_due_date: Joi.date().iso().allow(null, ''),
  rank_group: Joi.string().allow(null, '').max(100),
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(3).max(255),
  email: Joi.string().email({ tlds: { allow: false } }),
  password: Joi.string().min(6),
  role: Joi.string().valid('POLICE', 'ADMIN_MASTER'),
  status: Joi.string().valid('active', 'inactive', 'suspended'),
  subscription: Joi.string().valid('free', 'trial', 'premium'),
  payment_status: Joi.string().valid('paid', 'pending', 'overdue'),
  payment_due_date: Joi.date().iso().allow(null, ''),
  rank_group: Joi.string().allow(null, '').max(100),
}).or('name', 'email', 'password', 'role', 'status', 'subscription', 'payment_status', 'payment_due_date', 'rank_group');

const changeSubscriptionSchema = Joi.object({
  subscription: Joi.string().valid('free', 'trial', 'premium').required(),
});

const changePaymentStatusSchema = Joi.object({
  payment_status: Joi.string().valid('paid', 'pending', 'overdue').required(),
});

function validate(schema, req, res, next) {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((item) => item.message).join('; ');
    return next(new AppError('VALIDATION_ERROR', message, 400));
  }

  req.body = value;
  return next();
}

function validateCreateUser(req, res, next) {
  return validate(createUserSchema, req, res, next);
}

function validateUpdateUser(req, res, next) {
  return validate(updateUserSchema, req, res, next);
}

function validateChangeSubscription(req, res, next) {
  return validate(changeSubscriptionSchema, req, res, next);
}

function validateChangePaymentStatus(req, res, next) {
  return validate(changePaymentStatusSchema, req, res, next);
}

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateChangeSubscription,
  validateChangePaymentStatus,
};
