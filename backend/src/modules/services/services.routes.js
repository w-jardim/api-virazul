const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const resolvePlan = require('../../middlewares/resolvePlan');
const checkAccountStatus = require('../../middlewares/checkAccountStatus');
const checkLimits = require('../../middlewares/checkLimits');
const controller = require('./services.controller');
const validator = require('./services.validator');
const { incrementUsage } = require('../../services/usageService');
const { PLANS } = require('../../constants/plans');
const asyncHandler = require('../../utils/async-handler');

const router = express.Router();

router.use(authMiddleware);

router.post('/preview-financial', validator.validatePreviewFinancial, controller.previewFinancial);
router.post(
  '/',
  resolvePlan,
  checkAccountStatus,
  checkLimits,
  validator.validateCreate,
  asyncHandler(async (req, res) => {
    if (req.plan === 'preview' || !PLANS[req.plan]?.persistence) {
      return res.json({
        preview: true,
        message: 'Modo demonstração. Dados não são salvos.',
      });
    }
    const data = await require('./services.service').create(req.user, req.body);
    await incrementUsage(req.user.id);
    res.status(201).json({ data, meta: null, errors: null });
  })
);
router.get('/date-range', validator.validateListQuery, controller.getDateRange);
router.get('/', validator.validateListQuery, controller.list);
router.get('/:id', validator.validateIdParam, controller.getById);
router.put('/:id', validator.validateIdParam, validator.validateUpdate, controller.update);
router.post('/:id/transition', validator.validateIdParam, validator.validateTransition, controller.transition);
router.post('/:id/confirm-payment', validator.validateIdParam, validator.validateConfirmPayment, controller.confirmPayment);
router.post('/confirm-payment-pending', validator.validateListQuery, controller.confirmPendingPayments);
router.post('/:id/promote-reservation', validator.validateIdParam, validator.validatePromoteReservation, controller.promoteReservation);
router.delete('/:id', validator.validateIdParam, controller.remove);

module.exports = router;
