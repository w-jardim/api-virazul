const Joi = require('joi');
const AppError = require('../../utils/app-error');
const { DURATION_ALLOWED } = require('../services/services.rules');
const { ISO_WEEKDAYS } = require('./schedules.rules');

// ── existing: create individual/recurrent ordinary shift ─────────────────────

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

// ── schedule template ─────────────────────────────────────────────────────────

const weekdayEntry = Joi.object({
  weekday: Joi.number().integer().valid(...ISO_WEEKDAYS).required(),
  start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).default('07:00'),
  duration_hours: Joi.number().integer().valid(...DURATION_ALLOWED).required(),
});

const weeklyTemplateSchema = Joi.object({
  type: Joi.string().valid('WEEKLY').required(),
  entries: Joi.array().items(weekdayEntry).min(1).max(7).required(),
});

const biweeklyTemplateSchema = Joi.object({
  type: Joi.string().valid('BIWEEKLY').required(),
  reference_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  week_a: Joi.array().items(weekdayEntry).min(0).max(7).default([]),
  week_b: Joi.array().items(weekdayEntry).min(0).max(7).default([]),
});

const intervalTemplateSchema = Joi.object({
  type: Joi.string().valid('INTERVAL').required(),
  reference_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).default('07:00'),
  work_hours: Joi.number().integer().min(1).max(48).required(),
  off_hours: Joi.number().integer().min(1).max(168).required(),
});

const saveTemplateSchema = Joi.alternatives().try(
  weeklyTemplateSchema,
  biweeklyTemplateSchema,
  intervalTemplateSchema
);

const calendarQuerySchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
});

// ── helpers ───────────────────────────────────────────────────────────────────

function validate(schema, target) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      return next(new AppError('VALIDATION_ERROR', message, 400));
    }

    req[target] = value;
    return next();
  };
}

module.exports = {
  validateCreate: validate(createScheduleSchema, 'body'),
  validateSaveTemplate: validate(saveTemplateSchema, 'body'),
  validateCalendarQuery: validate(calendarQuerySchema, 'query'),
};
