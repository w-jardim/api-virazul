const env = require('../config/env');
const AppError = require('../utils/app-error');

module.exports = function errorHandler(err, req, res, next) {
  const error = err instanceof AppError
    ? err
    : new AppError('INTERNAL_ERROR', 'Erro interno do servidor.', 500);

  const payload = {
    data: null,
    meta: null,
    errors: [
      {
        code: error.code,
        message: error.message,
      },
    ],
  };

  if (env.nodeEnv !== 'production' && error.details) {
    payload.errors[0].details = error.details;
  }

  if (env.nodeEnv !== 'production' && !(err instanceof AppError)) {
    payload.errors[0].details = err.message;
  }

  return res.status(error.status).json(payload);
};
