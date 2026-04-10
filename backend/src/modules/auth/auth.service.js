const AppError = require('../../utils/app-error');
const passwordUtils = require('../../utils/password');
const jwtUtils = require('../../utils/jwt');
const authRepository = require('./auth.repository');

async function login(email, password) {
  const user = await authRepository.findByEmail(email);

  if (!user) {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Email ou senha invalidos.', 401);
  }

  const isPasswordValid = await passwordUtils.comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Email ou senha invalidos.', 401);
  }

  await authRepository.updateLastLogin(user.id);

  const token = jwtUtils.sign({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

async function me(userId) {
  const user = await authRepository.findSafeById(userId);

  if (!user) {
    throw new AppError('AUTH_USER_NOT_FOUND', 'Usuario autenticado nao encontrado.', 404);
  }

  return user;
}

module.exports = {
  login,
  me,
};
