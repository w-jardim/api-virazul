const AppError = require('../utils/app-error');
const jwtUtils = require('../utils/jwt');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return next(new AppError('AUTH_MISSING', 'Authorization header ausente.', 401));
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('AUTH_INVALID_FORMAT', 'Formato de Authorization invalido.', 401));
  }

  try {
    const payload = jwtUtils.verify(token);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch (error) {
    return next(new AppError('AUTH_INVALID_TOKEN', 'Token invalido ou expirado.', 401));
  }
};
