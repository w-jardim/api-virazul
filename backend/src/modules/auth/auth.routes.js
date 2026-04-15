const express = require('express');
const authController = require('./auth.controller');
const { validateLogin, validateRegister } = require('./auth.validator');
const authMiddleware = require('../../middlewares/auth');
const { loginLimiter } = require('../../middlewares/rate-limiters');

const router = express.Router();

router.post('/register', validateRegister, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.get('/me', authMiddleware, authController.me);
router.patch('/me', authMiddleware, require('./auth.validator').validateUpdateProfile, authController.updateProfile);

module.exports = router;
