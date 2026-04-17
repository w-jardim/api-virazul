const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./schedules.controller');
const validator = require('./schedules.validator');

const router = express.Router();

router.use(authMiddleware);

// existing: create individual ordinary shift entry in services table
router.post('/', validator.validateCreate, controller.create);

// template: define / retrieve / remove recurring schedule pattern
router.get('/template', controller.getTemplate);
router.put('/template', validator.validateSaveTemplate, controller.saveTemplate);
router.delete('/template', controller.deleteTemplate);

// calendar: compute work days for a month from the saved template (no DB write)
router.get('/calendar', validator.validateCalendarQuery, controller.getCalendar);

module.exports = router;
