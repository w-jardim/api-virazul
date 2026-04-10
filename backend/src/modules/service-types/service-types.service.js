const AppError = require('../../utils/app-error');
const repository = require('./service-types.repository');

function assertAdminMaster(authUser) {
  if (!authUser || authUser.role !== 'ADMIN_MASTER') {
    throw new AppError('FORBIDDEN', 'Apenas ADMIN_MASTER pode executar esta acao.', 403);
  }
}

async function list() {
  return repository.listAll();
}

async function create(authUser, payload) {
  assertAdminMaster(authUser);

  const existing = await repository.findByKey(payload.key);
  if (existing) {
    throw new AppError('SERVICE_TYPE_KEY_EXISTS', 'Ja existe um tipo de servico com esta chave.', 409);
  }

  return repository.create(payload);
}

module.exports = {
  list,
  create,
  assertAdminMaster,
};
