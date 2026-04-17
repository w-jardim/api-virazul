const express = require('express');
const authController = require('./auth.controller');
const {
  validateGoogleLogin,
  validateLogin,
  validateRegister,
  validateUpdateProfile,
} = require('./auth.validator');
const authMiddleware = require('../../middlewares/auth');
const { loginLimiter } = require('../../middlewares/rate-limiters');

const router = express.Router();

router.post('/register', validateRegister, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/google', loginLimiter, validateGoogleLogin, authController.loginWithGoogle);
router.get('/me', authMiddleware, authController.me);
router.patch('/me', authMiddleware, validateUpdateProfile, authController.updateProfile);

module.exports = router;
