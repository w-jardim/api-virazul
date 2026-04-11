const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./finance.controller');
const validator = require('./finance.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/summary', validator.validateSummaryQuery, controller.summary);
router.get('/report', validator.validateReportQuery, controller.report);

module.exports = router;
