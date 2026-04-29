const jwt = require('jsonwebtoken');
const env = require('../config/env');

function sign(payload, options = {}) {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
    ...options,
  });
}

function verify(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = {
  sign,
  verify,
};
