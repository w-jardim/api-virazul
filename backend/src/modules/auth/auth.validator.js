const Joi = require('joi');
const AppError = require('../../utils/app-error');

const RANK_GROUP_VALUES = [
  'OFICIAIS_SUPERIORES',
  'CAPITAO_TENENTE',
  'SUBTENENTE_SARGENTO',
  'CABO_SOLDADO'
];

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(6).required(),
});

const googleLoginSchema = Joi.object({
  id_token: Joi.string().min(10).required(),
}).unknown(false);

function validateLogin(req, res, next) {
  const { error, value } = loginSchema.validate(req.body, {
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

function validateGoogleLogin(req, res, next) {
  const { error, value } = googleLoginSchema.validate(req.body, {
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

const updateProfileSchema = Joi.object({
  name: Joi.string().min(1).optional(),
  monthly_hour_goal: Joi.number().integer().min(0).optional(),
  password: Joi.string().min(6).optional(),
  password_confirm: Joi.any().valid(Joi.ref('password')).when('password', { is: Joi.exist(), then: Joi.required() }).messages({ 'any.only': 'Confirmação de senha não corresponde.' }),
  rank_group: Joi.string().valid(...RANK_GROUP_VALUES).optional().allow(null),
  planning_preferences: Joi.object().unknown(true).optional().allow(null),
}).unknown(false);

const registerSchema = Joi.object({
  name: Joi.string().min(1).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(6).required(),
  password_confirm: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Confirmação de senha não corresponde.' }),
  rank_group: Joi.string().valid(...RANK_GROUP_VALUES).optional().allow(null)
}).unknown(false);

function validateUpdateProfile(req, res, next) {
  const { error, value } = updateProfileSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((item) => item.message).join('; ');
    return next(new AppError('VALIDATION_ERROR', message, 400));
  }

  if (value.password_confirm !== undefined) delete value.password_confirm;

  req.body = value;
  return next();
}

function validateRegister(req, res, next) {
  const { error, value } = registerSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((item) => item.message).join('; ');
    return next(new AppError('VALIDATION_ERROR', message, 400));
  }

  if (value.password_confirm !== undefined) delete value.password_confirm;

  // normalize email
  if (value.email) {
    value.email = value.email.trim().toLowerCase();
  }

  req.body = value;
  return next();
}

module.exports = {
  validateLogin,
  validateGoogleLogin,
  validateUpdateProfile,
  validateRegister,
};
