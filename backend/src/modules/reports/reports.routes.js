const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./reports.controller');
const validator = require('./reports.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/operational', validator.validateOperationalQuery, controller.operational);
router.get('/financial', validator.validateFinancialQuery, controller.financial);

module.exports = router;
