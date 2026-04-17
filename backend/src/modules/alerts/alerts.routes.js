const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./alerts.controller');
const validator = require('./alerts.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validator.validateListQuery, controller.list);
router.post('/:id/read', validator.validateIdParam, controller.read);
router.post('/:id/dismiss', validator.validateIdParam, controller.dismiss);

module.exports = router;
