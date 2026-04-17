const { OAuth2Client } = require('google-auth-library');
const env = require('../../config/env');
const AppError = require('../../utils/app-error');
const logger = require('../../utils/logger');

let oauthClient = null;

function getOAuthClient() {
  if (!env.google.clientId) {
    throw new AppError(
      'AUTH_GOOGLE_NOT_CONFIGURED',
      'Autenticacao Google nao configurada no servidor.',
      503
    );
  }

  if (!oauthClient) {
    oauthClient = new OAuth2Client();
  }

  return oauthClient;
}

async function verifyIdToken(idToken) {
  try {
    const client = getOAuthClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new AppError('AUTH_GOOGLE_INVALID_TOKEN', 'Token Google invalido.', 401);
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.warn('auth.google.verify.failed', { error: error.message });
    throw new AppError('AUTH_GOOGLE_INVALID_TOKEN', 'Token Google invalido.', 401);
  }
}

module.exports = {
  verifyIdToken,
};
