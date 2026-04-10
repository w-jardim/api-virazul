const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./service-types.controller');
const validator = require('./service-types.validator');

const router = express.Router();

router.use(authMiddleware);
router.get('/', controller.list);
router.post('/', validator.validateCreate, controller.create);

module.exports = router;
