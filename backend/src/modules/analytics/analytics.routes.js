const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./analytics.controller');

const router = express.Router();

router.use(authMiddleware);

// GET /api/v1/analytics/user?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
router.get('/user', controller.user);

module.exports = router;
