const logger = require('../utils/logger');

module.exports = function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = req.requestId || null;

  logger.info('http.request.start', {
    request_id: requestId,
    method: req.method,
    path: req.originalUrl,
  });

  res.on('finish', () => {
    logger.info('http.request.finish', {
      request_id: requestId,
      method: req.method,
      path: req.originalUrl,
      status_code: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });

  next();
};
