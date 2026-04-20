const Joi = require('joi');
const AppError = require('../../utils/app-error');
const {
  OPERATIONAL_STATUSES,
  INITIAL_OPERATIONAL_STATUSES,
  FINANCIAL_STATUSES,
  DURATION_ALLOWED,
} = require('./services.rules');

const VALID_RANK_GROUPS = ['OFICIAIS_SUPERIORES', 'CAPITAO_TENENTE', 'SUBTENENTE_SARGENTO', 'CABO_SOLDADO'];

const createSchema = Joi.object({
  user_id: Joi.number().integer().positive().optional(),
  service_type_id: Joi.number().integer().positive().required(),
  start_at: Joi.date().iso().required(),
  duration_hours: Joi.number().integer().valid(...DURATION_ALLOWED).required(),
  force: Joi.boolean().default(false),
  operational_status: Joi.string().valid(...INITIAL_OPERATIONAL_STATUSES).default('TITULAR'),
  reservation_expires_at: Joi.date().iso().allow(null),
  notes: Joi.string().allow('', null),
  financial_status: Joi.string().valid(...FINANCIAL_STATUSES).default('PENDENTE'),
  rank_group: Joi.string().valid(...VALID_RANK_GROUPS).optional(),
  amount_base: Joi.number().min(0).default(0),
  amount_paid: Joi.number().min(0).default(0),
  amount_meal: Joi.number().min(0).default(0),
  amount_transport: Joi.number().min(0).default(0),
  amount_additional: Joi.number().min(0).default(0),
  amount_discount: Joi.number().min(0).default(0),
});

const updateSchema = Joi.object({
  service_type_id: Joi.number().integer().positive().optional(),
  start_at: Joi.date().iso().optional(),
  duration_hours: Joi.number().integer().valid(...DURATION_ALLOWED).optional(),
  force: Joi.boolean().default(false),
  reservation_expires_at: Joi.date().iso().allow(null),
  notes: Joi.string().allow('', null),
  rank_group: Joi.string().valid(...VALID_RANK_GROUPS).optional(),
  amount_base: Joi.number().min(0).optional(),
  amount_paid: Joi.number().min(0).optional(),
  amount_meal: Joi.number().min(0).optional(),
  amount_transport: Joi.number().min(0).optional(),
  amount_additional: Joi.number().min(0).optional(),
  amount_discount: Joi.number().min(0).optional(),
  operational_status: Joi.any().forbidden(),
  financial_status: Joi.any().forbidden(),
}).min(1);

const transitionSchema = Joi.object({
  transition_type: Joi.string().trim().min(2).max(100).required(),
  target_operational_status: Joi.string().valid(...OPERATIONAL_STATUSES).optional(),
  target_financial_status: Joi.string().valid(...FINANCIAL_STATUSES).optional(),
  reason: Joi.string().trim().allow('', null).max(500),
}).or('target_operational_status', 'target_financial_status');

const previewFinancialSchema = Joi.object({
  service_type_id: Joi.number().integer().positive().required(),
  duration_hours: Joi.number().integer().valid(...DURATION_ALLOWED).required(),
  amount_base: Joi.number().min(0).optional(),
  amount_meal: Joi.number().min(0).optional(),
  amount_transport: Joi.number().min(0).optional(),
}).required();

const confirmPaymentSchema = Joi.object({
  payment_at: Joi.date().iso().optional(),
  reason: Joi.string().trim().allow('', null).max(500),
}).unknown(false);

const promoteReservationSchema = Joi.object({
  reason: Joi.string().trim().allow('', null).max(500),
}).unknown(false);

const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const listQuerySchema = Joi.object({
  user_id: Joi.number().integer().positive().optional(),
  service_type_id: Joi.number().integer().positive().optional(),
}).unknown(false);

function validate(schema, target) {
  return (req, res, next) => {
    const source = target || 'body';
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
  validateCreate: validate(createSchema, 'body'),
  validateUpdate: validate(updateSchema, 'body'),
  validateTransition: validate(transitionSchema, 'body'),
  validateConfirmPayment: validate(confirmPaymentSchema, 'body'),
  validatePromoteReservation: validate(promoteReservationSchema, 'body'),
  validatePreviewFinancial: validate(previewFinancialSchema, 'body'),
  validateIdParam: validate(idParamSchema, 'params'),
  validateListQuery: validate(listQuerySchema, 'query'),
};
