const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./schedules.controller');
const validator = require('./schedules.validator');

const router = express.Router();

router.use(authMiddleware);
router.post('/', validator.validateCreate, controller.create);

module.exports = router;
