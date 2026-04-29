const asyncHandler = require('../../utils/async-handler');
const billingService = require('./billing.service');
const { validateCheckout, validatePix } = require('./billing.validator');
const AppError = require('../../utils/app-error');

const getSubscription = asyncHandler(async (req, res) => {
  const data = await billingService.getSubscriptionStatus(req.user.id);
  res.status(200).json({ data, meta: null, errors: null });
});

const createCheckoutPremium = asyncHandler(async (req, res, next) => {
  const { error } = validateCheckout(req.body);
  if (error) {
    return next(new AppError('VALIDATION_ERROR', error.message, 400));
  }
  const result = await billingService.createCheckoutPremium(req.user.id, req.user.email, req.body.plan_code);
  res.status(200).json({ data: result, meta: null, errors: null });
});

const createPixCharge = asyncHandler(async (req, res, next) => {
  const { error } = validatePix(req.body);
  if (error) {
    return next(new AppError('VALIDATION_ERROR', error.message, 400));
  }
  const result = await billingService.createPixCharge(req.user.id, req.user.email, req.body.plan_code);
  res.status(200).json({ data: result, meta: null, errors: null });
});

const cancelSubscription = asyncHandler(async (req, res) => {
  const result = await billingService.cancelUserSubscription(req.user.id);
  res.status(200).json({ data: result, meta: null, errors: null });
});

module.exports = {
  getSubscription,
  createCheckoutPremium,
  createPixCharge,
  cancelSubscription,
};
