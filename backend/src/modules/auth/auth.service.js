const AppError = require('../../utils/app-error');
const passwordUtils = require('../../utils/password');
const jwtUtils = require('../../utils/jwt');
const authRepository = require('./auth.repository');
const googleTokenService = require('./google-token.service');
const logger = require('../../utils/logger');

function buildSession(user) {
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
      rank_group: user.rank_group || null,
      subscription: user.subscription || 'free',
      payment_due_date: user.payment_due_date || null,
      created_at: user.created_at,
    },
  };
}

async function login(email, password) {
  const user = await authRepository.findByEmail(email);

  if (!user) {
    logger.warn('auth.login.failed', { email });
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Email ou senha invalidos.', 401);
  }

  const isPasswordValid = await passwordUtils.comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    logger.warn('auth.login.failed', { email, user_id: user.id });
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Email ou senha invalidos.', 401);
  }

  await authRepository.updateLastLogin(user.id);

  logger.info('auth.login.success', {
    user_id: user.id,
    email: user.email,
  });

  return buildSession(user);
}

async function loginWithGoogle(idToken) {
  const payload = await googleTokenService.verifyIdToken(idToken);
  const email = payload.email ? String(payload.email).toLowerCase() : '';
  const googleSub = payload.sub ? String(payload.sub) : '';
  const emailVerified = Boolean(payload.email_verified);

  if (!email || !googleSub || !emailVerified) {
    logger.warn('auth.google.claims.invalid', {
      email,
      has_sub: Boolean(googleSub),
      email_verified: emailVerified,
    });
    throw new AppError(
      'AUTH_GOOGLE_INVALID_CLAIMS',
      'Conta Google sem dados obrigatorios verificados.',
      401
    );
  }

  let user = await authRepository.findByGoogleSub(googleSub);

  if (!user) {
    const userByEmail = await authRepository.findByEmail(email);
    if (userByEmail) {
      if (userByEmail.google_sub && userByEmail.google_sub !== googleSub) {
        throw new AppError(
          'AUTH_GOOGLE_CONFLICT',
          'Conta Google diferente ja vinculada a este email.',
          409
        );
      }

      if (!userByEmail.google_sub) {
        await authRepository.linkGoogleSubByUserId(userByEmail.id, googleSub);
      }

      user = await authRepository.findByEmail(email);
    } else {
      const fallbackName = email.split('@')[0];
      user = await authRepository.createGoogleUser({
        name: payload.name || fallbackName,
        email,
        googleSub,
      });
    }
  }

  if (!user) {
    throw new AppError('AUTH_GOOGLE_FAILED', 'Falha ao autenticar com Google.', 500);
  }

  await authRepository.updateLastLogin(user.id);
  logger.info('auth.google.login.success', { user_id: user.id, email });

  return buildSession(user);
}

async function me(userId) {
  const user = await authRepository.findSafeById(userId);

  if (!user) {
    logger.warn('auth.me.user_not_found', { user_id: userId });
    throw new AppError('AUTH_USER_NOT_FOUND', 'Usuario autenticado nao encontrado.', 404);
  }

  return user;
}

async function updateProfile(userId, payload) {
  const existing = await authRepository.findSafeById(userId);

  if (!existing) {
    throw new AppError('AUTH_USER_NOT_FOUND', 'Usuario autenticado nao encontrado.', 404);
  }

  // Only allow updating planning preferences through this endpoint for now
  const planningRepo = require('../planning/planning.repository');

  let currentPrefs = null;
  try {
    const row = await planningRepo.getUserPreferences(userId);
    currentPrefs = row ? row.planning_preferences : null;
  } catch (e) {
    currentPrefs = null;
  }

  const incoming = payload.planning_preferences || {};
  const merged = Object.assign({}, typeof currentPrefs === 'string' ? JSON.parse(currentPrefs || '{}') : (currentPrefs || {}), incoming);

  await planningRepo.updateUserPlanningPreferences(userId, merged);

  // Return fresh user object
  const user = await authRepository.findSafeById(userId);
  return user;
}

module.exports = {
  login,
  loginWithGoogle,
  me,
  updateProfile,
};

