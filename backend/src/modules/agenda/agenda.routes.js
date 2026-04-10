const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./agenda.controller');
const validator = require('./agenda.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/day', validator.validateDayQuery, controller.day);
router.get('/week', validator.validateWeekQuery, controller.week);
router.get('/month', validator.validateMonthQuery, controller.month);

module.exports = router;
