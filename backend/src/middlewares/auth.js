const AppError = require('../utils/app-error');
const jwtUtils = require('../utils/jwt');
const logger = require('../utils/logger');
const { enforceSubscription } = require('./subscription-guard');
const { enforcePlan } = require('./plan-guard');

module.exports = async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    logger.warn('auth.missing_header', {
      request_id: req.requestId || null,
      path: req.originalUrl,
    });
    return next(new AppError('AUTH_MISSING', 'Authorization header ausente.', 401));
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    logger.warn('auth.invalid_header_format', {
      request_id: req.requestId || null,
      path: req.originalUrl,
    });
    return next(new AppError('AUTH_INVALID_FORMAT', 'Formato de Authorization invalido.', 401));
  }

  try {
    const payload = jwtUtils.verify(token);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      session_id: payload.sid || null,
      session_expires_at:
        typeof payload.exp === 'number'
          ? new Date(payload.exp * 1000).toISOString()
          : null,
    };
    return enforceSubscription(req, res, (err) => {
      if (err) return next(err);
      return enforcePlan(req, res, next);
    });
  } catch (error) {
    logger.warn('auth.invalid_token', {
      request_id: req.requestId || null,
      path: req.originalUrl,
    });
    return next(new AppError('AUTH_INVALID_TOKEN', 'Token invalido ou expirado.', 401));
  }
};
