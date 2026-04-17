const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const AppError = require('../utils/app-error');

function buildLimiter({ windowMs, max, message, code }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(new AppError(code, message, 429));
    },
  });
}

const globalApiLimiter = buildLimiter({
  windowMs: env.rateLimit.globalWindowMs,
  max: env.rateLimit.globalMax,
  message: 'Muitas requisicoes. Tente novamente mais tarde.',
  code: 'RATE_LIMIT_EXCEEDED',
});

const loginLimiter = buildLimiter({
  windowMs: env.rateLimit.loginWindowMs,
  max: env.rateLimit.loginMax,
  message: 'Muitas tentativas de login. Aguarde antes de tentar novamente.',
  code: 'AUTH_RATE_LIMIT_EXCEEDED',
});

module.exports = {
  globalApiLimiter,
  loginLimiter,
  buildLimiter,
};
