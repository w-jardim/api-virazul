const AppError = require('../../utils/app-error');
const adminRepository = require('./admin.repository');

async function getStats() {
  return adminRepository.getStats();
}

async function listUsers() {
  return adminRepository.findAll();
}

async function createUser(payload) {
  const user = await adminRepository.create(payload);
  if (!user) {
    throw new AppError('CREATE_USER_FAILED', 'Nao foi possivel criar o usuario.', 500);
  }
  return user;
}

async function updateUser(id, payload) {
  const user = await adminRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }
  return adminRepository.updateById(id, payload);
}

async function deleteUser(id) {
  const user = await adminRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }
  const deleted = await adminRepository.deleteById(id);
  if (!deleted) {
    throw new AppError('DELETE_USER_FAILED', 'Nao foi possivel remover o usuario.', 500);
  }
}

async function changeSubscription(id, subscription) {
  const user = await adminRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }
  return adminRepository.updateSubscription(id, subscription);
}

async function changePaymentStatus(id, paymentStatus) {
  const user = await adminRepository.findById(id);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Usuario nao encontrado.', 404);
  }
  return adminRepository.updatePaymentStatus(id, paymentStatus);
}

module.exports = {
  getStats,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  changeSubscription,
  changePaymentStatus,
};
