const express = require('express');
const authController = require('./auth.controller');
const { validateLogin } = require('./auth.validator');
const authMiddleware = require('../../middlewares/auth');
const { loginLimiter } = require('../../middlewares/rate-limiters');

const router = express.Router();

router.post('/login', loginLimiter, validateLogin, authController.login);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
