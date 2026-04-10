const express = require('express');
const authController = require('./auth.controller');
const { validateLogin } = require('./auth.validator');
const authMiddleware = require('../../middlewares/auth');

const router = express.Router();

router.post('/login', validateLogin, authController.login);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
