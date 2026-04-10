const asyncHandler = require('../../utils/async-handler');
const authService = require('./auth.service');

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

module.exports = {
  login,
  me,
};
