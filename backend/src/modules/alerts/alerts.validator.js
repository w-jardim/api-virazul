const Joi = require('joi');
const AppError = require('../../utils/app-error');

const ALERT_TYPES = ['DAY', 'OPERATIONAL', 'FINANCIAL'];
const ALERT_STATUSES = ['ACTIVE', 'READ', 'DISMISSED'];

const listQuerySchema = Joi.object({
  type: Joi.string().valid(...ALERT_TYPES).optional(),
  status: Joi.string().valid(...ALERT_STATUSES).optional(),
}).unknown(false);

const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

function validate(schema, target) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const message = error.details.map((item) => item.message).join('; ');
      return next(new AppError('VALIDATION_ERROR', message, 400));
    }

    req[target] = value;
    return next();
  };
}

module.exports = {
  ALERT_TYPES,
  ALERT_STATUSES,
  validateListQuery: validate(listQuerySchema, 'query'),
  validateIdParam: validate(idParamSchema, 'params'),
};
