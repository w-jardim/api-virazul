const crypto = require('crypto');

module.exports = function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const requestId = incoming && String(incoming).trim() ? String(incoming).trim() : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};
