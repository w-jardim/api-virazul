const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const controller = require('./planning.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/summary', controller.summary);
router.get('/suggestions', controller.suggestions);

module.exports = router;
