const usersRepository = require('./users.repository');

async function getById(id) {
  return usersRepository.findById(id);
}

module.exports = {
  getById,
};
