const Joi = require('joi');
const AppError = require('../../utils/app-error');
const { DURATION_ALLOWED } = require('../services/services.rules');
const { ISO_WEEKDAYS } = require('./schedules.rules');

const createScheduleSchema = Joi.object({
  user_id: Joi.number().integer().positive().optional(),
  start_at: Joi.date().iso().required(),
  duration_hours: Joi.number()
    .integer()
    .valid(...DURATION_ALLOWED)
    .required(),
  notes: Joi.string().allow('', null),
  force: Joi.boolean().default(false),
  recurrence: Joi.object({
    weekdays: Joi.array()
      .items(Joi.number().integer().valid(...ISO_WEEKDAYS))
      .min(1)
      .unique()
      .required(),
    period_days: Joi.number().integer().min(1).max(90).default(30),
  }).optional(),
});

function validateCreate(req, res, next) {
  const { value, error } = createScheduleSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const message = error.details.map((item) => item.message).join('; ');
    return next(new AppError('VALIDATION_ERROR', message, 400));
  }

  req.body = value;
  return next();
}

module.exports = {
  validateCreate,
};
