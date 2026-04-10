const usersService = require('./users.service');

async function findById(req, res, next) {
  try {
    const user = await usersService.getById(req.params.id);
    res.status(200).json({ data: user, meta: null, errors: null });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  findById,
};
