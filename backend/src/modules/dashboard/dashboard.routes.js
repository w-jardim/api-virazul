const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./dashboard.controller');

const router = express.Router();

router.use(authMiddleware);
router.get('/summary', controller.summary);

module.exports = router;
