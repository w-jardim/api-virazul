const asyncHandler = require('../../utils/async-handler');
const usersService = require('./users.service');

const findById = asyncHandler(async (req, res) => {
  const user = await usersService.getById(req.params.id);
  res.status(200).json({ data: user, meta: null, errors: null });
});

module.exports = {
  findById,
};
