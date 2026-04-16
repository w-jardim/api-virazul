const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./services.controller');
const validator = require('./services.validator');

const router = express.Router();

router.use(authMiddleware);

router.post('/preview-financial', validator.validatePreviewFinancial, controller.previewFinancial);
router.post('/', validator.validateCreate, controller.create);
router.get('/date-range', validator.validateListQuery, controller.getDateRange);
router.get('/', validator.validateListQuery, controller.list);
router.get('/:id', validator.validateIdParam, controller.getById);
router.put('/:id', validator.validateIdParam, validator.validateUpdate, controller.update);
router.post('/:id/transition', validator.validateIdParam, validator.validateTransition, controller.transition);
router.post('/:id/confirm-payment', validator.validateIdParam, validator.validateConfirmPayment, controller.confirmPayment);
router.post('/:id/promote-reservation', validator.validateIdParam, validator.validatePromoteReservation, controller.promoteReservation);
router.delete('/:id', validator.validateIdParam, controller.remove);

module.exports = router;
