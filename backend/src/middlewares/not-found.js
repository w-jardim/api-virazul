const AppError = require('../utils/app-error');

module.exports = function notFound(req, res, next) {
  next(new AppError('NOT_FOUND', 'Rota nao encontrada.', 404));
};
