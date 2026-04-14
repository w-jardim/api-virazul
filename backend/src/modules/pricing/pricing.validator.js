const Joi = require('joi');
const AppError = require('../../utils/app-error');
const { VALID_RANK_GROUPS, VALID_SERVICE_SCOPES } = require('./pricing.repository');

const VALID_DURATIONS = [6, 8, 12, 24];

const listBaseValuesSchema = Joi.object({
  rank_group: Joi.string().valid(...VALID_RANK_GROUPS).optional(),
  duration_hours: Joi.number().integer().valid(...VALID_DURATIONS).optional(),
  date: Joi.date().iso().optional(),
}).unknown(false);

const listFinancialRulesSchema = Joi.object({
  service_scope: Joi.string().valid(...VALID_SERVICE_SCOPES).optional(),
  date: Joi.date().iso().optional(),
}).unknown(false);

const previewSchema = Joi.object({
  service_scope: Joi.string().valid(...VALID_SERVICE_SCOPES).required(),
  rank_group: Joi.string().valid(...VALID_RANK_GROUPS).required(),
  duration_hours: Joi.number().integer().valid(...VALID_DURATIONS).required(),
  date: Joi.date().iso().optional(),
}).unknown(false);

function validate(schema, target) {
  return (req, res, next) => {
    const source = target || 'query';
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const message = error.details.map((item) => item.message).join('; ');
      return next(new AppError('VALIDATION_ERROR', message, 400));
    }

    req[source] = value;
    return next();
  };
}

module.exports = {
  validateListBaseValues: validate(listBaseValuesSchema, 'query'),
  validateListFinancialRules: validate(listFinancialRulesSchema, 'query'),
  validatePreview: validate(previewSchema, 'query'),
};
