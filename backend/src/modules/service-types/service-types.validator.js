const Joi = require('joi');
const AppError = require('../../utils/app-error');

const ALLOWED_CATEGORIES = ['ORDINARY', 'RAS', 'PROEIS', 'OTHER'];

const createServiceTypeSchema = Joi.object({
  key: Joi.string().trim().lowercase().pattern(/^[a-z0-9_]+$/).min(3).max(100).required(),
  name: Joi.string().trim().min(2).max(255).required(),
  category: Joi.string().valid(...ALLOWED_CATEGORIES).required(),
  allows_reservation: Joi.boolean().default(false),
  requires_manual_value: Joi.boolean().default(false),
  counts_in_financial: Joi.boolean().default(true),
  shows_in_agenda: Joi.boolean().default(true),
  accounting_rules: Joi.object().unknown(true).default({}),
});

function validateCreate(req, res, next) {
  const { value, error } = createServiceTypeSchema.validate(req.body, {
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

module.exports = {
  ALLOWED_CATEGORIES,
  validateCreate,
};
