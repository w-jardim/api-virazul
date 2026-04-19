const Joi = require('joi');

const checkoutSchema = Joi.object({}).unknown(true);
const pixSchema = Joi.object({}).unknown(true);
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
