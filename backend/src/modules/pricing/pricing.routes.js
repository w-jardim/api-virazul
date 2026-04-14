const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./pricing.controller');
const validator = require('./pricing.validator');

const router = express.Router();

router.use(authMiddleware);

// GET /api/v1/pricing/base-values
router.get('/base-values', validator.validateListBaseValues, controller.listBaseValues);

// GET /api/v1/pricing/financial-rules
router.get('/financial-rules', validator.validateListFinancialRules, controller.listFinancialRules);

// GET /api/v1/pricing/preview
router.get('/preview', validator.validatePreview, controller.preview);

module.exports = router;
