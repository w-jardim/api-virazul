const Joi = require('joi');
const AppError = require('../../utils/app-error');
const { OPERATIONAL_STATUSES, FINANCIAL_STATUSES } = require('../services/services.rules');

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (!dateRegex.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function buildBaseSchema(extra = {}) {
  return Joi.object({
    start_date: Joi.string()
      .custom((value, helpers) => (isValidDateString(value) ? value : helpers.error('any.invalid')))
      .optional(),
    end_date: Joi.string()
      .custom((value, helpers) => (isValidDateString(value) ? value : helpers.error('any.invalid')))
      .optional(),
    service_type: Joi.string().trim().min(2).max(100).optional(),
    ...extra,
  })
    .custom((value, helpers) => {
      if (value.start_date && value.end_date && value.end_date < value.start_date) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .unknown(false);
}

const operationalSchema = buildBaseSchema({
  operational_status: Joi.string()
    .valid(...OPERATIONAL_STATUSES)
    .optional(),
});

const financialSchema = buildBaseSchema({
  financial_status: Joi.string()
    .valid(...FINANCIAL_STATUSES)
    .optional(),
});

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
  validateOperationalQuery: validate(operationalSchema),
  validateFinancialQuery: validate(financialSchema),
};
