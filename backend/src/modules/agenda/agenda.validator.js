const Joi = require('joi');
const AppError = require('../../utils/app-error');

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const monthRegex = /^\d{4}-\d{2}$/;

function isValidDateString(value) {
  if (!dateRegex.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidMonthString(value) {
  if (!monthRegex.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}-01T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 7) === value;
}

const daySchema = Joi.object({
  date: Joi.string().custom((value, helpers) => {
    if (!isValidDateString(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required(),
  user_id: Joi.number().integer().positive().optional(),
}).unknown(false);

const weekSchema = Joi.object({
  start: Joi.string().custom((value, helpers) => {
    if (!isValidDateString(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required(),
  user_id: Joi.number().integer().positive().optional(),
}).unknown(false);

const monthSchema = Joi.object({
  month: Joi.string().custom((value, helpers) => {
    if (!isValidMonthString(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required(),
  user_id: Joi.number().integer().positive().optional(),
}).unknown(false);

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const message = error.details.map((item) => item.message).join('; ');
      return next(new AppError('VALIDATION_ERROR', message, 400));
    }

    req.query = value;
    return next();
  };
}

module.exports = {
  validateDayQuery: validate(daySchema),
  validateWeekQuery: validate(weekSchema),
  validateMonthQuery: validate(monthSchema),
};
