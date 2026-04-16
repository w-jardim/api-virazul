const AppError = require('../../utils/app-error');
const usersRepository = require('./users.repository');

async function getById(id) {
  const user = await usersRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }
  return user;
}

module.exports = {
  getById,
};
