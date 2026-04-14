const express = require('express');
const adminController = require('./admin.controller');
const adminValidator = require('./admin.validator');
const authMiddleware = require('../../middlewares/auth');
const adminOnly = require('../../middlewares/admin-only');

const router = express.Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.listUsers);
router.post('/users', adminValidator.validateCreateUser, adminController.createUser);
router.patch('/users/:id', adminValidator.validateUpdateUser, adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/subscription', adminValidator.validateChangeSubscription, adminController.changeSubscription);
router.patch('/users/:id/payment-status', adminValidator.validateChangePaymentStatus, adminController.changePaymentStatus);

module.exports = router;
