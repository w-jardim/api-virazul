const Joi = require('joi');
const { NEW_PLAN_CODES } = require('../../constants/plans');

const checkoutSchema = Joi.object({
  plan_code: Joi.string().valid(...NEW_PLAN_CODES.filter((code) => code !== 'plan_free')).default('plan_pro'),
}).unknown(true);
const pixSchema = Joi.object({
  plan_code: Joi.string().valid(...NEW_PLAN_CODES.filter((code) => code !== 'plan_free')).default('plan_pro'),
}).unknown(true);
const cancelSchema = Joi.object({}).unknown(true);

function validateCheckout(body) {
  return checkoutSchema.validate(body || {});
}

function validatePix(body) {
  return pixSchema.validate(body || {});
}

function validateCancel(body) {
  return cancelSchema.validate(body || {});
}

module.exports = { validateCheckout, validatePix, validateCancel };
