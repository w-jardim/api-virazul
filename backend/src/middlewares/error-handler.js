const env = require('../config/env');
const AppError = require('../utils/app-error');
const logger = require('../utils/logger');

module.exports = function errorHandler(err, req, res, next) {
  const appError =
    err instanceof AppError ? err : new AppError('INTERNAL_ERROR', 'Erro interno do servidor.', 500);
  const requestId = req.requestId || null;

  logger.error('http.request.error', {
    request_id: requestId,
    path: req.originalUrl,
    method: req.method,
    status_code: appError.status,
    error: err,
  });

  const responseError = {
    code: appError.code,
    message: appError.message,
    request_id: requestId,
  };

  if (env.nodeEnv !== 'production') {
    if (appError.details) {
      responseError.details = appError.details;
    }
    if (!(err instanceof AppError) && err && err.message) {
      responseError.debug = err.message;
      responseError.stack = err.stack;
    }
  }

  return res.status(appError.status).json({
    data: null,
    meta: null,
    errors: [responseError],
  });
};
