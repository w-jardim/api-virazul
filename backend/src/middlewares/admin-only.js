const AppError = require('../utils/app-error');

module.exports = function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN_MASTER') {
    return next(new AppError('FORBIDDEN', 'Apenas ADMIN_MASTER pode executar esta acao.', 403));
  }

  return next();
};
