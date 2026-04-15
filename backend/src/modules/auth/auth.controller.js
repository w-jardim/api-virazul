const asyncHandler = require('../../utils/async-handler');
const AppError = require('../../utils/app-error');
const authService = require('./auth.service');
const adminRepository = require('../admin/admin.repository');
const authRepository = require('./auth.repository');
const jwtUtils = require('../../utils/jwt');
const logger = require('../../utils/logger');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  res.status(200).json({
    data: result,
    meta: null,
    errors: null,
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);

  res.status(200).json({
    data: user,
    meta: null,
    errors: null,
  });
});

async function updateProfile(req, res, next) {
  try {
    const payload = req.body;
    // Prevent role escalation
    delete payload.role;
    const updated = await adminRepository.updateById(req.user.id, payload);
    return res.json({ data: updated, meta: null, errors: null });
  } catch (error) {
    logger.warn('auth.update.failed', { user_id: req.user?.id });
    return next(error);
  }
}

module.exports = {
  login,
  me,
  updateProfile,
};

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await authRepository.findByEmail(email);
    if (existing) {
      return next(new AppError('AUTH_EMAIL_TAKEN', 'Email ja cadastrado.', 400));
    }

    const created = await adminRepository.create({
      name,
      email,
      password,
      role: 'POLICE',
      status: 'active',
      subscription: 'free'
    });

    const token = jwtUtils.sign({ id: created.id, email: created.email, role: created.role });

    return res.status(201).json({
      data: {
        token,
        user: {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          rank_group: created.rank_group || null,
          subscription: created.subscription || 'free',
          payment_due_date: created.payment_due_date || null,
          created_at: created.created_at,
        }
      },
      meta: null,
      errors: null,
    });
  } catch (error) {
    logger.error('auth.register.failed', { error: error.message });
    return next(error);
  }
}
