const express = require('express');
const authMiddleware = require('../../middlewares/auth');
const usersController = require('./users.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/:id', usersController.findById);

module.exports = router;
