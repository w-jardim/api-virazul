const Joi = require('joi');
const AppError = require('../../utils/app-error');

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(6).required(),
});

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

module.exports = {
  validateLogin,
};
