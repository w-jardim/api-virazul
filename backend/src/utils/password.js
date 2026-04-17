const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  comparePassword,
};
