const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const billingController = require('./billing.controller');
const billingWebhookController = require('./billing.webhook.controller');

const router = express.Router();

// Public: Mercado Pago webhook (no auth — MP calls this directly)
router.post('/webhooks/mercadopago', (req, res) => {
  billingWebhookController.handleMercadoPago(req, res);
});

// Protected endpoints
router.get('/subscription', authMiddleware, billingController.getSubscription);
router.post('/checkout/premium', authMiddleware, billingController.createCheckoutPremium);
router.post('/pix/charge', authMiddleware, billingController.createPixCharge);
router.post('/subscription/cancel', authMiddleware, billingController.cancelSubscription);

module.exports = router;
